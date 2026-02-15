/**
 * OTP Driver Authentication Utilities
 * 
 * Helper functions for managing driver OTP authentication
 * including phone verification, linking drivers to auth users, etc.
 */

import { supabase } from './supabase';
import type { Database } from './supabase';

type DriverRow = Database['public']['Tables']['drivers']['Row'];
type DriverUpdate = Database['public']['Tables']['drivers']['Update'];

/**
 * Check if a driver's phone is verified
 */
export const isPhoneVerified = (driver: DriverRow): boolean => {
  return driver.phone_verified_at !== null && driver.phone_verified_at !== undefined;
};

/**
 * Get the time since phone was verified (in minutes)
 */
export const getVerificationAgeMinutes = (driver: DriverRow): number | null => {
  if (!driver.phone_verified_at) return null;
  
  const verifiedAt = new Date(driver.phone_verified_at).getTime();
  const now = new Date().getTime();
  return Math.floor((now - verifiedAt) / (1000 * 60));
};

/**
 * Mark a driver's phone as verified
 */
export const markPhoneAsVerified = async (
  driverId: number,
  verifiedAt?: Date
): Promise<{ data: DriverRow | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({
        phone_verified_at: (verifiedAt || new Date()).toISOString(),
      })
      .eq('id', driverId)
      .select()
      .single();

    return { data, error: error ? new Error(error.message) : null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

/**
 * Link a driver to a Supabase Auth user
 */
export const linkDriverToAuthUser = async (
  driverId: number,
  userId: string
): Promise<{ data: DriverRow | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({
        user_id: userId,
      })
      .eq('id', driverId)
      .select()
      .single();

    return { data, error: error ? new Error(error.message) : null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

/**
 * Link a driver to auth user AND verify phone
 * This is typically done after OTP verification succeeds
 */
export const completePhoneVerification = async (
  driverId: number,
  userId: string
): Promise<{ data: DriverRow | null; error: Error | null }> => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('drivers')
      .update({
        user_id: userId,
        phone_verified_at: now,
      })
      .eq('id', driverId)
      .select()
      .single();

    return { data, error: error ? new Error(error.message) : null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

/**
 * Get a driver by phone number and organization
 * Useful for OTP login flows
 */
export const getDriverByPhone = async (
  phone: string,
  orgId: number
): Promise<{ data: DriverRow | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('phone', phone)
      .eq('org_id', orgId)
      .single();

    return { data, error: error ? new Error(error?.message || 'Not found') : null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

/**
 * Get all unverified drivers in an organization
 */
export const getUnverifiedDrivers = async (
  orgId: number
): Promise<{ data: DriverRow[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('org_id', orgId)
      .is('phone_verified_at', null)
      .order('created_at', { ascending: false });

    return { data, error: error ? new Error(error.message) : null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

/**
 * Get all verified drivers in an organization
 */
export const getVerifiedDrivers = async (
  orgId: number
): Promise<{ data: DriverRow[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('org_id', orgId)
      .not('phone_verified_at', 'is', null)
      .order('created_at', { ascending: false });

    return { data, error: error ? new Error(error.message) : null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

/**
 * Get a driver by their associated auth user ID
 */
export const getDriverByUserId = async (
  userId: string
): Promise<{ data: DriverRow | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userId)
      .single();

    return { data, error: error ? new Error(error?.message || 'Not found') : null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

/**
 * Unlink a driver from their auth user
 * (marks them as unverified but keeps the record)
 */
export const unlinkDriverFromAuthUser = async (
  driverId: number
): Promise<{ data: DriverRow | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({
        user_id: null,
        phone_verified_at: null,
      })
      .eq('id', driverId)
      .select()
      .single();

    return { data, error: error ? new Error(error.message) : null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

/**
 * Check if a phone number is already in use by another driver in the same org
 * Returns true if phone exists
 */
export const isPhoneAlreadyInUse = async (
  phone: string,
  orgId: number,
  excludeDriverId?: number
): Promise<boolean> => {
  try {
    let query = supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('org_id', orgId);

    if (excludeDriverId) {
      query = query.neq('id', excludeDriverId);
    }

    const { count } = await query;
    return (count ?? 0) > 0;
  } catch (error) {
    console.error('Error checking phone in use:', error);
    return false;
  }
};

/**
 * Normalize a phone number to a standard format
 * Ensures consistent storage (e.g., +254712345678)
 */
export const normalizePhoneNumber = (phone: string): string => {
  // Remove any whitespace, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // If it starts with 07, 01, etc (Kenya), convert to +254
  if (cleaned.match(/^(0)[17]/)) {
    cleaned = '+254' + cleaned.substring(1);
  }

  // If it's just digits without +, add + prefix
  if (cleaned.match(/^\d+$/)) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
};

/**
 * Validate phone number format
 * Basic validation - checks if it looks like a valid international number
 */
export const isValidPhoneFormat = (phone: string): boolean => {
  // Check if it matches international format: +<country_code><number>
  // or Kenya specific format: +254<number>
  return /^\+\d{10,15}$/.test(phone.replace(/[\s\-()]/g, ''));
};

/**
 * Get verification status summary for an organization
 */
export const getVerificationStatusSummary = async (
  orgId: number
): Promise<{
  total: number;
  verified: number;
  unverified: number;
  verificationRate: number;
} | null> => {
  try {
    const { data: totalData } = await supabase
      .from('drivers')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId);

    const { data: verifiedData } = await supabase
      .from('drivers')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .not('phone_verified_at', 'is', null);

    const total = totalData?.length ?? 0;
    const verified = verifiedData?.length ?? 0;
    const unverified = total - verified;
    const verificationRate = total > 0 ? Math.round((verified / total) * 100) : 0;

    return { total, verified, unverified, verificationRate };
  } catch (error) {
    console.error('Error getting verification status:', error);
    return null;
  }
};

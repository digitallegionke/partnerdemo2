/**
 * Type definitions for Driver OTP Authentication
 */

import type { Session } from '@supabase/supabase-js';
import type { Database } from './supabase';

export type DriverRow = Database['public']['Tables']['drivers']['Row'];

/**
 * Request body for requesting OTP
 */
export interface RequestOtpRequest {
  phone: string;
}

/**
 * Response for requesting OTP
 */
export interface RequestOtpResponse {
  success: boolean;
  message: string;
  attemptsRemaining?: number;
}

/**
 * Request body for verifying OTP
 */
export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

/**
 * Response for verifying OTP
 */
export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  session?: Session | null;
  driver?: DriverRow | null;
  isFirstLogin?: boolean;
  organization_name?: string;
}

/**
 * Error response for OTP endpoints
 */
export interface OtpErrorResponse {
  error: string;
  code?: string;
  retryAfter?: number;
}

/**
 * OTP Error codes for consistent error handling
 */
export enum OtpErrorCode {
  INVALID_PHONE = 'INVALID_PHONE',
  PHONE_NOT_REGISTERED = 'PHONE_NOT_REGISTERED',
  INVALID_OTP = 'INVALID_OTP',
  EXPIRED_OTP = 'EXPIRED_OTP',
  NOT_A_DRIVER = 'NOT_A_DRIVER',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  DRIVER_INACTIVE = 'DRIVER_INACTIVE',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * Generic OTP Exception class for typed errors
 */
export class OtpException extends Error {
  constructor(
    public code: OtpErrorCode,
    public statusCode: number,
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'OtpException';
  }
}

/**
 * Get user-friendly error message (hides implementation details)
 */
export function getOtpErrorMessage(code: OtpErrorCode): string {
  const messages: Record<OtpErrorCode, string> = {
    [OtpErrorCode.INVALID_PHONE]: 'Please enter a valid phone number.',
    [OtpErrorCode.PHONE_NOT_REGISTERED]: 'This phone number is not registered. Please contact your administrator.',
    [OtpErrorCode.INVALID_OTP]: 'Invalid OTP code. Please check and try again.',
    [OtpErrorCode.EXPIRED_OTP]: 'OTP code has expired. Please request a new one.',
    [OtpErrorCode.NOT_A_DRIVER]: 'This account is not configured as a driver account.',
    [OtpErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many OTP requests. Please try again later.',
    [OtpErrorCode.SUPABASE_ERROR]: 'Authentication service temporarily unavailable. Please try again later.',
    [OtpErrorCode.DRIVER_INACTIVE]: 'Your driver account is currently inactive. Please contact your administrator.',
    [OtpErrorCode.DATABASE_ERROR]: 'Database error. Please try again later.',
  };

  return messages[code] || 'An error occurred during authentication.';
}

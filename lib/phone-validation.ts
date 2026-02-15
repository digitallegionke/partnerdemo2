/**
 * Phone Number Validation and Formatting
 * 
 * Utilities for validating and formatting phone numbers
 */

/**
 * Validate phone number format
 * Accepts formats like: +1234567890, +1 (234) 567-8900, 1234567890
 * Returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-().+]/g, '');

  // Must be 7-15 digits (E.164 standard allows up to 15 digits)
  // And should start with digits (optionally with leading + for international)
  const phoneRegex = /^\+?[0-9]{7,15}$/;
  
  return phoneRegex.test(cleaned);
}

/**
 * Normalize phone number to E.164 format
 * This format is expected by Supabase OTP: +[country code][number]
 * 
 * Examples:
 * - "+1234567890" -> "+1234567890"
 * - "1234567890" -> "+1234567890"
 * - "+1 (234) 567-8900" -> "+12345678900"
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.trim();
  
  // If starts with +, keep it and remove non-digits after
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.slice(1).replace(/\D/g, '');
  } else {
    // Remove all non-digits
    cleaned = cleaned.replace(/\D/g, '');
    // Add + prefix
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Validate and normalize phone number in one step
 * Returns normalized number if valid, null if invalid
 */
export function validateAndNormalizePhone(phone: string | null | undefined): string | null {
  if (!isValidPhoneNumber(phone)) return null;
  return normalizePhoneNumber(phone as string);
}

/**
 * Extract phone number for display (removes +)
 */
export function formatPhoneForDisplay(phone: string): string {
  return phone.replace(/^\+/, '');
}

/**
 * Check if phone starts with country code
 */
export function hasCountryCode(phone: string): boolean {
  return phone.startsWith('+');
}

/**
 * Get country code from phone
 */
export function getCountryCode(phone: string): string | null {
  if (!phone.startsWith('+')) return null;

  // Common country code lengths: 1-3 digits
  // Try to extract likely country codes
  const match = phone.match(/^\+(\d{1,3})/);
  return match ? match[1] : null;
}

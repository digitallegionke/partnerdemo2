/**
 * Tracking Number Utilities
 *
 * Centralized functions for generating and formatting tracking numbers
 */

/**
 * Generate a formatted tracking number from delivery ID
 * Format: RD + zero-padded 6-digit ID (e.g., RD000123)
 */
export function formatTrackingNumber(deliveryId: number): string {
  return `RD${deliveryId.toString().padStart(6, '0')}`;
}

/**
 * Parse a tracking number to extract the delivery ID
 * Accepts: RD000123, rd000123, 000123, or just 123
 * Returns null if parsing fails
 */
export function parseTrackingNumber(trackingNumber: string): number | null {
  const cleaned = trackingNumber.trim().toUpperCase();

  // Remove RD prefix if present
  const numericPart = cleaned.replace(/^RD/, '');

  // Parse as integer
  const id = parseInt(numericPart, 10);

  return isNaN(id) ? null : id;
}

/**
 * Generate the full tracking URL for a delivery
 */
export function getTrackingUrl(deliveryId: number): string {
  const trackingNumber = formatTrackingNumber(deliveryId);
  // Use relative URL that works in any environment
  return `/track?trackingNumber=${trackingNumber}`;
}

/**
 * Generate the full absolute tracking URL (for sharing via SMS/WhatsApp)
 */
export function getAbsoluteTrackingUrl(deliveryId: number, baseUrl?: string): string {
  const trackingNumber = formatTrackingNumber(deliveryId);
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/track?trackingNumber=${trackingNumber}`;
}

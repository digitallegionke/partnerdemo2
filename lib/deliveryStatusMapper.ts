/**
 * Delivery Status Mapper
 *
 * The driver app and the web app use different status value strings for the
 * same Supabase `deliveries.status` column. This utility provides a single
 * source of truth for translating between the two schemas.
 *
 * Driver app statuses (written directly to Supabase):
 *   available | accepted | pickup | on_the_way | delivered | failed
 *
 * Web app statuses (used in the admin UI and API responses):
 *   pending | in-progress | completed | failed
 */

export type DriverStatus =
  | 'available'
  | 'accepted'
  | 'pickup'
  | 'on_the_way'
  | 'delivered'
  | 'failed';

export type WebStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Driver → Web  (used when reading from DB for API responses)
// ---------------------------------------------------------------------------
const DRIVER_TO_WEB: Record<string, WebStatus> = {
  // Driver-native values
  available:    'pending',
  accepted:     'in-progress',
  pickup:       'in-progress',
  on_the_way:   'in-progress',
  delivered:    'completed',
  failed:       'failed',
  // Web-native values (pass-through — handle deliveries created by web app)
  pending:      'pending',
  'in-progress': 'in-progress',
  completed:    'completed',
};

// ---------------------------------------------------------------------------
// Web → Driver  (used when writing status from the admin panel)
// ---------------------------------------------------------------------------
const WEB_TO_DRIVER: Record<string, DriverStatus> = {
  pending:       'available',
  'in-progress': 'on_the_way',
  completed:     'delivered',
  failed:        'failed',
  // Driver-native values (pass-through — accept raw driver statuses in PATCH)
  available:   'available',
  accepted:    'accepted',
  pickup:      'pickup',
  on_the_way:  'on_the_way',
  delivered:   'delivered',
};

/**
 * Translate a raw DB status (driver format) to a web-display status.
 * Unknown values are returned as-is so the UI can still render something.
 */
export function toWebStatus(rawStatus: string): WebStatus {
  return DRIVER_TO_WEB[rawStatus] ?? (rawStatus as WebStatus);
}

/**
 * Translate a web-display status to the driver-compatible value that will
 * be written to Supabase.
 * Unknown values are returned as-is.
 */
export function toDriverStatus(webStatus: string): DriverStatus {
  return WEB_TO_DRIVER[webStatus] ?? (webStatus as DriverStatus);
}

/**
 * Apply status normalization to a single delivery object returned from Supabase.
 * Returns a new object — does not mutate the original.
 */
export function normalizeDeliveryStatus<T extends { status?: string }>(delivery: T): T {
  if (!delivery.status) return delivery;
  return { ...delivery, status: toWebStatus(delivery.status) };
}

/**
 * Apply status normalization to an array of deliveries.
 */
export function normalizeDeliveryStatuses<T extends { status?: string }>(deliveries: T[]): T[] {
  return deliveries.map(normalizeDeliveryStatus);
}

/**
 * Delivery Status Mapper
 *
 * Maps legacy driver-app status values to the current provider-portal status
 * values. The provider portal now owns the canonical status strings; the
 * driver-app strings are only kept for backwards compatibility with existing rows.
 *
 * Provider portal status flow:
 *   awaiting_approval → pending → out_for_delivery → in_transit → delivered
 *                                ↘ rejected
 *                  out_for_delivery ↘ cancelled
 *
 * Legacy driver-app statuses (mapped on read):
 *   available | accepted | pickup | on_the_way | delivered | failed
 */

export type DeliveryStatus =
  | 'awaiting_approval'
  | 'pending'
  | 'rejected'
  | 'out_for_delivery'
  | 'cancelled'
  | 'in_transit'
  | 'delivered'
  | 'failed';

/** @deprecated kept only for mapper compatibility */
export type WebStatus = DeliveryStatus;

const LEGACY_TO_STATUS: Record<string, DeliveryStatus> = {
  // Legacy driver-app values (kept for backward compat with old driver-written rows)
  available:     'awaiting_approval',
  accepted:      'out_for_delivery',
  pickup:        'out_for_delivery',
  on_the_way:    'in_transit',
  completed:     'delivered',
  'in-progress': 'in_transit',
  // NOTE: 'pending' is intentionally NOT mapped — it is a valid new-flow status
  // meaning "approved by provider, awaiting driver acceptance".
};

/**
 * Normalise a raw DB status string to the current DeliveryStatus enum.
 * Current provider-portal values are passed through unchanged.
 */
export function toWebStatus(rawStatus: string): DeliveryStatus {
  return (LEGACY_TO_STATUS[rawStatus] ?? rawStatus) as DeliveryStatus;
}

export function normalizeDeliveryStatus<T extends { status?: string }>(delivery: T): T {
  if (!delivery.status) return delivery;
  return { ...delivery, status: toWebStatus(delivery.status) };
}

export function normalizeDeliveryStatuses<T extends { status?: string }>(deliveries: T[]): T[] {
  return deliveries.map(normalizeDeliveryStatus);
}

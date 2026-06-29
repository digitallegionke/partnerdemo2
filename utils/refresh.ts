/**
 * Scoped refresh utility — event-based invalidation for client components.
 *
 * HOW IT WORKS
 * ─────────────
 * After any data mutation, call `refresh(scope)`.
 * Any page that is currently mounted and listening for that scope re-fetches
 * immediately. Pages that are not mounted do nothing — they naturally re-fetch
 * when the user navigates to them and the component mounts again.
 *
 * RULE: invalidate the NARROWEST scope that actually changed.
 *   ✓ refresh("drivers")              — only the drivers list re-fetches
 *   ✓ refresh("drivers"); refresh("navCounts")  — list + sidebar badge
 *   ✗ refresh everything on every mutation       — causes API fan-out
 */

// ─── Scope registry ───────────────────────────────────────────────────────────
// Add a new key here when you add a new data domain. The value is the internal
// browser CustomEvent name — treat it as an opaque identifier.

export const REFRESH_SCOPES = {
  drivers:          "refresh:drivers",
  fleet:            "refresh:fleet",
  routes:           "refresh:routes",
  routeNames:       "refresh:route-names",
  deliveries:       "refresh:deliveries",
  deliveryBookings: "refresh:delivery-bookings",
  clients:          "refresh:clients",
  requests:         "refresh:requests",
  navCounts:        "navcount:refresh",   // kept in sync with dashboard layout listener
} as const;

export type RefreshScope = keyof typeof REFRESH_SCOPES;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Signal that data within `scope` has changed.
 *
 * @example
 * // After creating/updating/deleting a driver:
 * refresh("drivers");
 * refresh("navCounts");
 */
export function refresh(scope: RefreshScope): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REFRESH_SCOPES[scope]));
}

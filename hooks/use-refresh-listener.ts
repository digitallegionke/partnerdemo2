"use client";

import { useEffect, useRef } from "react";
import { REFRESH_SCOPES, type RefreshScope } from "@/utils/refresh";

/**
 * Subscribe a page/component to one refresh scope.
 *
 * When `refresh(scope)` is called from anywhere, `onRefresh` fires.
 * The listener is removed automatically when the component unmounts, so
 * unmounted pages are never triggered.
 *
 * The ref pattern keeps the effect stable — `onRefresh` can be an inline
 * function without causing the listener to be re-registered every render.
 *
 * @example
 * // Inside a page component:
 * useRefreshListener("drivers", loadDrivers);
 */
export function useRefreshListener(
  scope: RefreshScope,
  onRefresh: () => void,
): void {
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  useEffect(() => {
    const eventName = REFRESH_SCOPES[scope];
    const handler = () => callbackRef.current();
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [scope]); // re-registers only if the scope itself changes
}

/**
 * Driver OTP Client Library
 * 
 * Provides client-side helpers for driver authentication
 * Including OTP request/verification and session management
 */

import type {
  RequestOtpRequest,
  RequestOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  OtpErrorResponse,
} from './otp-types';
import type { Session } from '@supabase/supabase-js';

export interface DriverSession {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
}

export interface DriverAuthState {
  isAuthenticated: boolean;
  driverId: number | null;
  phone: string | null;
  session: DriverSession | null;
  isFirstLogin: boolean;
}

/**
 * Driver OTP Authentication Client
 * 
 * Handles OTP request/verification and session management
 */
export class DriverOtpClient {
  private baseUrl: string;
  private storagePrefix: string = 'driver_auth_';

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || '/api';
  }

  /**
   * Request OTP for a driver phone number
   */
  async requestOtp(phone: string): Promise<RequestOtpResponse> {
    const response = await fetch(`${this.baseUrl}/drivers/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone } as RequestOtpRequest),
    });

    if (!response.ok) {
      const error = (await response.json()) as OtpErrorResponse;
      throw new OtpClientError(
        error.error || 'Failed to request OTP',
        response.status,
        error.code,
        error.retryAfter
      );
    }

    return response.json() as Promise<RequestOtpResponse>;
  }

  /**
   * Verify OTP code and authenticate driver
   */
  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
    const response = await fetch(`${this.baseUrl}/drivers/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp } as VerifyOtpRequest),
    });

    if (!response.ok) {
      const error = (await response.json()) as OtpErrorResponse;
      throw new OtpClientError(
        error.error || 'Failed to verify OTP',
        response.status,
        error.code
      );
    }

    const data = (await response.json()) as VerifyOtpResponse;

    // Save session if authentication successful
    if (data.success && data.session?.access_token) {
      this.saveSession(data.session as DriverSession);
      if (data.driver) {
        this.saveDriverId(data.driver.id);
      }
    }

    return data;
  }

  /**
   * Get current authentication state
   */
  getAuthState(): DriverAuthState {
    const session = this.getSession();
    const driverId = this.getDriverId();

    return {
      isAuthenticated: !!session?.access_token,
      driverId,
      phone: this.getPhone(),
      session,
      isFirstLogin: this.getIsFirstLogin(),
    };
  }

  /**
   * Get current session
   */
  getSession(): DriverSession | null {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}session`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save session
   */
  saveSession(session: DriverSession): void {
    localStorage.setItem(
      `${this.storagePrefix}session`,
      JSON.stringify(session)
    );
  }

  /**
   * Clear session (logout)
   */
  clearSession(): void {
    localStorage.removeItem(`${this.storagePrefix}session`);
    localStorage.removeItem(`${this.storagePrefix}driver_id`);
    localStorage.removeItem(`${this.storagePrefix}phone`);
    localStorage.removeItem(`${this.storagePrefix}is_first_login`);
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.getSession()?.access_token || null;
  }

  /**
   * Get driver ID
   */
  getDriverId(): number | null {
    try {
      const id = localStorage.getItem(`${this.storagePrefix}driver_id`);
      return id ? parseInt(id, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save driver ID
   */
  private saveDriverId(driverId: number): void {
    localStorage.setItem(`${this.storagePrefix}driver_id`, driverId.toString());
  }

  /**
   * Get saved phone
   */
  getPhone(): string | null {
    return localStorage.getItem(`${this.storagePrefix}phone`);
  }

  /**
   * Save phone
   */
  savePhone(phone: string): void {
    localStorage.setItem(`${this.storagePrefix}phone`, phone);
  }

  /**
   * Check if this was first login
   */
  getIsFirstLogin(): boolean {
    const stored = localStorage.getItem(`${this.storagePrefix}is_first_login`);
    return stored === 'true';
  }

  /**
   * Set first login flag
   */
  private setIsFirstLogin(isFirstLogin: boolean): void {
    localStorage.setItem(
      `${this.storagePrefix}is_first_login`,
      isFirstLogin.toString()
    );
  }

  /**
   * Check if session is still valid
   */
  isSessionValid(): boolean {
    const session = this.getSession();
    if (!session?.access_token) return false;

    // Check if token expired
    if (session.expires_at) {
      return session.expires_at > Math.floor(Date.now() / 1000);
    }

    return true;
  }

  /**
   * Get remaining session time in seconds
   */
  getSessionExpiresIn(): number | null {
    const session = this.getSession();
    if (!session?.expires_at) return null;

    const remaining = session.expires_at - Math.floor(Date.now() / 1000);
    return remaining > 0 ? remaining : null;
  }

  /**
   * Set up automatic logout when session expires
   */
  setupAutoLogout(onExpire?: () => void): (() => void) | null {
    const expiresIn = this.getSessionExpiresIn();
    if (!expiresIn) return null;

    const timeout = setTimeout(() => {
      this.clearSession();
      onExpire?.();
    }, expiresIn * 1000);

    return () => clearTimeout(timeout);
  }
}

/**
 * Custom error class for OTP client errors
 */
export class OtpClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'OtpClientError';
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }
}

// Create singleton instance
export const driverOtpClient = new DriverOtpClient();

/**
 * React Hook for Driver Authentication
 * 
 * Usage:
 * const { auth, isLoading, error, requestOtp, verifyOtp, logout } = useDriverAuth();
 * 
 * Note: This hook requires React to be imported
 * 'use client' is required in Next.js 13+ App Router
 */
export function useDriverAuth() {
  // Dynamic React import for SSR compatibility
  if (!React || !React.useState) {
    throw new Error('useDriverAuth must be called in a client component with React available');
  }

  const [auth, setAuth] = React.useState(null as DriverAuthState | null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null as string | null);

  React.useEffect(() => {
    setAuth(driverOtpClient.getAuthState());
  }, []);

  const requestOtp = async (phone: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await driverOtpClient.requestOtp(phone);
      driverOtpClient.savePhone(phone);
      return response;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to request OTP';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await driverOtpClient.verifyOtp(phone, otp);
      setAuth(driverOtpClient.getAuthState());
      return response;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to verify OTP';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    driverOtpClient.clearSession();
    setAuth(driverOtpClient.getAuthState());
    setError(null);
  };

  return {
    auth,
    isLoading,
    error,
    requestOtp,
    verifyOtp,
    logout,
    client: driverOtpClient,
  };
}

// Only import React if in client environment
let React: any;
if (typeof window !== 'undefined') {
  try {
    React = require('react');
  } catch {
    // React not available
  }
}

export default DriverOtpClient;

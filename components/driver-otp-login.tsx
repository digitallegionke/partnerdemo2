/**
 * Example: Driver OTP Login Component
 * 
 * A complete, production-ready React component for driver authentication
 * Using the OTP endpoints and client library
 * 
 * Usage: Import into your app and use like:
 * <DriverOtpLoginPage />
 * 
 * Features:
 * - Two-step flow (phone → OTP)
 * - Loading states
 * - Error handling with user-friendly messages
 * - Rate limit notifications
 * - Phone format validation
 * - Automatic redirect on success
 */

'use client'; // Next.js 13+ App Router

import React, { useState, useCallback } from 'react';
import { driverOtpClient, OtpClientError } from '@/lib/driver-otp-client';
import { isValidPhoneNumber } from '@/lib/phone-validation';

interface LoginStep {
  type: 'phone' | 'otp';
}

interface ErrorState {
  message: string;
  code?: string;
  retryAfter?: number;
}

/**
 * Driver OTP Login Page Component
 * 
 * Complete example showing both request and verify flows
 */
export function DriverOtpLoginPage() {
  // State management
  const [step, setStep] = useState<LoginStep['type']>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null
  );

  /**
   * Handle phone submission
   */
  const handlePhoneSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      // Validate phone format
      if (!isValidPhoneNumber(phone)) {
        setError({
          message: 'Please enter a valid phone number (e.g., +1234567890)',
          code: 'INVALID_PHONE',
        });
        setIsLoading(false);
        return;
      }

      try {
        const response = await driverOtpClient.requestOtp(phone);

        // Save phone for next step
        driverOtpClient.savePhone(phone);

        // Update UI
        setAttemptsRemaining(response.attemptsRemaining || 0);
        setStep('otp');
        setOtp('');
      } catch (err) {
        if (err instanceof OtpClientError) {
          const message = getErrorMessage(err);

          setError({
            message,
            code: err.code,
            retryAfter: err.retryAfter,
          });

          // Show rate limit info
          if (err.isRateLimited()) {
            console.warn(
              `Rate limited. Retry after ${err.retryAfter} seconds`
            );
          }
        } else {
          setError({
            message:
              'An unexpected error occurred. Please try again later.',
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [phone]
  );

  /**
   * Handle OTP submission
   */
  const handleOtpSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      // Basic OTP validation
      if (!otp || otp.length < 4) {
        setError({
          message: 'Please enter a valid OTP code',
          code: 'INVALID_OTP',
        });
        setIsLoading(false);
        return;
      }

      try {
        const response = await driverOtpClient.verifyOtp(phone, otp);

        if (response.success && response.driver) {
          // Authentication successful
          console.log('Login successful', {
            driverId: response.driver.id,
            driverName: response.driver.name,
            isFirstLogin: response.isFirstLogin,
          });

          // Show welcome message if first login
          if (response.isFirstLogin) {
            alert(
              `Welcome ${response.driver.name}! Your account has been activated.`
            );
          }

          // Redirect to dashboard
          // Adjust the URL based on your app structure
          window.location.href = '/dashboard';
        }
      } catch (err) {
        if (err instanceof OtpClientError) {
          const message = getErrorMessage(err);

          setError({
            message,
            code: err.code,
          });
        } else {
          setError({
            message:
              'An unexpected error occurred. Please try again later.',
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [phone, otp]
  );

  /**
   * Handle back button
   */
  const handleBack = useCallback(() => {
    setStep('phone');
    setOtp('');
    setError(null);
    setAttemptsRemaining(null);
  }, []);

  /**
   * Format phone for display
   */
  const displayPhone = phone.replace(/^\+/, '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Roundi</h1>
          <p className="text-slate-400">Driver Login</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-lg shadow-xl p-8">
          {/* Phone Step */}
          {step === 'phone' ? (
            <PhoneInputForm
              phone={phone}
              onPhoneChange={setPhone}
              onSubmit={handlePhoneSubmit}
              isLoading={isLoading}
              error={error}
            />
          ) : (
            /* OTP Step */
            <OtpInputForm
              phone={displayPhone}
              otp={otp}
              onOtpChange={setOtp}
              onSubmit={handleOtpSubmit}
              onBack={handleBack}
              isLoading={isLoading}
              error={error}
              attemptsRemaining={attemptsRemaining}
            />
          )}

          {/* Info Text */}
          <p className="text-xs text-slate-500 text-center mt-6">
            {step === 'phone'
              ? 'Enter your registered phone number'
              : 'Enter the 6-digit code sent to your phone'}
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          For admin access,{' '}
          <a href="/auth/signin" className="text-blue-400 hover:text-blue-300">
            sign in with email
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * Phone Input Form Component
 */
interface PhoneInputFormProps {
  phone: string;
  onPhoneChange: (phone: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: ErrorState | null;
}

function PhoneInputForm({
  phone,
  onPhoneChange,
  onSubmit,
  isLoading,
  error,
}: PhoneInputFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-slate-200 mb-2"
        >
          Phone Number
        </label>
        <input
          id="phone"
          type="tel"
          placeholder="+1 (234) 567-8900"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          disabled={isLoading}
          required
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <p className="text-xs text-slate-400 mt-1">
          Format: +1234567890 or (123) 456-7890
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <ErrorAlert
          message={error.message}
          isRateLimit={error.code === 'RATE_LIMIT_EXCEEDED'}
          retryAfter={error.retryAfter}
        />
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !phone}
        className="w-full bg-[#C8E298] hover:bg-[#274690] disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <Spinner className="mr-2" />
            Sending OTP...
          </span>
        ) : (
          'Request OTP'
        )}
      </button>
    </form>
  );
}

/**
 * OTP Input Form Component
 */
interface OtpInputFormProps {
  phone: string;
  otp: string;
  onOtpChange: (otp: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isLoading: boolean;
  error: ErrorState | null;
  attemptsRemaining: number | null;
}

function OtpInputForm({
  phone,
  otp,
  onOtpChange,
  onSubmit,
  onBack,
  isLoading,
  error,
  attemptsRemaining,
}: OtpInputFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="otp"
          className="block text-sm font-medium text-slate-200 mb-2"
        >
          Verification Code
        </label>
        <p className="text-sm text-slate-400 mb-3">
          Sent to {phone}
          <button
            type="button"
            onClick={onBack}
            className="ml-2 text-blue-400 hover:text-blue-300"
            disabled={isLoading}
          >
            Change
          </button>
        </p>

        <input
          id="otp"
          type="text"
          placeholder="000000"
          value={otp}
          onChange={(e) => onOtpChange(e.target.value.slice(0, 6))}
          disabled={isLoading}
          maxLength={6}
          pattern="\d{0,6}"
          required
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-2xl tracking-widest placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <p className="text-xs text-slate-400 mt-1">6-digit code</p>
      </div>

      {/* Attempts Remaining */}
      {attemptsRemaining !== null && attemptsRemaining < 3 && (
        <div className="text-xs text-amber-400">
          {attemptsRemaining} attempt(s) remaining
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <ErrorAlert
          message={error.message}
          isRateLimit={error.code === 'RATE_LIMIT_EXCEEDED'}
        />
      )}

      {/* Buttons */}
      <div className="space-y-2">
        <button
          type="submit"
          disabled={isLoading || otp.length < 6}
          className="w-full bg-[#C8E298] hover:bg-[#274690] disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <Spinner className="mr-2" />
              Verifying...
            </span>
          ) : (
            'Verify OTP'
          )}
        </button>

        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Back
        </button>
      </div>
    </form>
  );
}

/**
 * Error Alert Component
 */
interface ErrorAlertProps {
  message: string;
  isRateLimit?: boolean;
  retryAfter?: number;
}

function ErrorAlert({
  message,
  isRateLimit,
  retryAfter,
}: ErrorAlertProps) {
  return (
    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-300">
      {message}
      {isRateLimit && retryAfter && (
        <p className="mt-1 text-xs">
          Try again in {retryAfter} second{retryAfter !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

/**
 * Loading Spinner Component
 */
function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(err: OtpClientError): string {
  // Use the message from the server if available
  if (err.message) return err.message;

  // Fallback messages based on status
  if (err.isRateLimited()) {
    return 'Too many attempts. Please try again later.';
  }
  if (err.isNotFound()) {
    return 'Phone number not found. Please contact your administrator.';
  }
  if (err.isForbidden()) {
    return 'Access denied. Your account may not be configured as a driver.';
  }
  if (err.isServerError()) {
    return 'Server error. Please try again later.';
  }

  return 'An error occurred. Please try again.';
}

export default DriverOtpLoginPage;

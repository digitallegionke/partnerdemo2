/**
 * In-memory Rate Limiter
 * 
 * Tracks OTP requests per phone number with a sliding window approach.
 * This is a simple in-memory implementation suitable for single-instance deployments.
 * For production multi-instance deployments, use Upstash Redis or similar.
 */

interface RateLimitEntry {
  attempts: number;
  firstAttemptTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private readonly MAX_ATTEMPTS: number;
  private readonly WINDOW_MS: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxAttempts: number = 3, windowMinutes: number = 5) {
    this.MAX_ATTEMPTS = maxAttempts;
    this.WINDOW_MS = windowMinutes * 60 * 1000;
    this.startCleanup();
  }

  /**
   * Check if a request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or window expired
    if (!entry || now - entry.firstAttemptTime > this.WINDOW_MS) {
      this.store.set(key, { attempts: 1, firstAttemptTime: now });
      return true;
    }

    // Still within window
    if (entry.attempts < this.MAX_ATTEMPTS) {
      entry.attempts += 1;
      return true;
    }

    return false;
  }

  /**
   * Get remaining attempts for a key
   */
  getRemainingAttempts(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return this.MAX_ATTEMPTS;

    const now = Date.now();
    if (now - entry.firstAttemptTime > this.WINDOW_MS) {
      return this.MAX_ATTEMPTS;
    }

    return Math.max(0, this.MAX_ATTEMPTS - entry.attempts);
  }

  /**
   * Get time until rate limit resets (in seconds)
   */
  getResetTime(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const now = Date.now();
    const timeUntilReset = entry.firstAttemptTime + this.WINDOW_MS - now;
    
    return Math.max(0, Math.ceil(timeUntilReset / 1000));
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Start background cleanup to remove old entries
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.store.entries()) {
        if (now - entry.firstAttemptTime > this.WINDOW_MS * 2) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.store.delete(key));
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton instance for OTP requests
// Max 3 attempts per phone in 5 minutes
export const otpRateLimiter = new RateLimiter(3, 5);

export default RateLimiter;

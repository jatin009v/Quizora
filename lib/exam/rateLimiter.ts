/**
 * In-Memory Sliding-Window Rate Limiter for Access-Code Validation Protection.
 * Compatible with serverless / Node environments.
 * Default limit: 5 invalid code attempts per 60 seconds per student IP/UserId.
 */
class SlidingWindowRateLimiter {
  private attempts = new Map<string, number[]>(); // key -> timestamps[]

  public isRateLimited(
    key: string,
    maxAttempts: number = 5,
    windowMs: number = 60000
  ): { limited: boolean; remainingAttempts: number; retryAfterSeconds: number } {
    const now = Date.now();
    const timestamps = (this.attempts.get(key) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxAttempts) {
      const oldestAttempt = timestamps[0];
      const retryAfterSeconds = Math.ceil((oldestAttempt + windowMs - now) / 1000);
      return {
        limited: true,
        remainingAttempts: 0,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }

    return {
      limited: false,
      remainingAttempts: maxAttempts - timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  public recordAttempt(key: string) {
    const now = Date.now();
    const timestamps = (this.attempts.get(key) || []).filter((t) => now - t < 60000);
    timestamps.push(now);
    this.attempts.set(key, timestamps);
  }

  public reset(key: string) {
    this.attempts.delete(key);
  }
}

export const accessCodeRateLimiter = new SlidingWindowRateLimiter();

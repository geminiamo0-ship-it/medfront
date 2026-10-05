import { ThrottlerModuleOptions } from "@nestjs/throttler";

/**
 * IMPORTANT: every named throttler used by a `@Throttle({ name: { … } })`
 * decorator MUST be registered here. If the name is missing, the decorator's
 * override is silently dropped and the route falls through to the `default`
 * throttler — which lets brute-force attacks slip past at 100 req/min.
 *
 * The values below are *initial* limits. The real values come from
 * `AppThrottlerGuard.handleRequest`, which reads them from `SettingsService`
 * (DB-backed) at request time so ops can tune them without redeploying.
 *
 * Keep these initial values aligned with the in-code defaults inside
 * `handleRequest`'s `getNumber(..., fallback)` calls.
 */
export const buildRateLimitOptions = (): ThrottlerModuleOptions => {
  return {
    throttlers: [
      // Global fallback for any route without a more specific @Throttle.
      { name: "default", ttl: 60_000, limit: 100 },

      // Auth: login, register, OTP send/verify, forgot/reset password.
      // Tight by design — these are the prime brute-force / enumeration
      // targets. Combined with per-OTP attempt counter (5) and the
      // exponential block backoff in AppThrottlerGuard.
      { name: "auth", ttl: 60_000, limit: 5, blockDuration: 600_000 },

      // Public read/write resources (profiles, public stats, etc).
      { name: "public_resource", ttl: 60_000, limit: 120, blockDuration: 60_000 },

      // Media proxy — bandwidth-heavy, abuse-prone.
      { name: "media", ttl: 60_000, limit: 20, blockDuration: 300_000 },

      // AI burst (Gemini / DeepSeek calls). Cost-sensitive.
      { name: "ai_burst", ttl: 60_000, limit: 10, blockDuration: 120_000 },

      // Job applications — flood prevention on careers form.
      { name: "job_application", ttl: 600_000, limit: 3, blockDuration: 1_800_000 },

      // Test creation — expensive DB churn if abused.
      { name: "test_create", ttl: 60_000, limit: 10, blockDuration: 300_000 },

      // Library article views — high-value content, anti-scrape.
      { name: "library_view", ttl: 60_000, limit: 30, blockDuration: 300_000 },
    ],
  };
};

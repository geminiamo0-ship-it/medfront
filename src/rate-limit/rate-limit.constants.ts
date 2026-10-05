// Named constants passed to @Throttle({ … }) decorators. The NAME of each
// throttler (auth, public_resource, …) must also be registered in
// rate-limit.config.ts or the @Throttle override is silently dropped.
//
// `ttl` and `blockDuration` are in MILLISECONDS (@nestjs/throttler v6 contract).
// In practice these values are re-computed at request time by
// AppThrottlerGuard.handleRequest using values from SettingsService, so the
// constants below act as type-safe placeholders + audit-trail of intent.
export const AUTH_THROTTLE = { auth: { limit: 5, ttl: 60_000, blockDuration: 600_000 } };
export const PUBLIC_RESOURCE_THROTTLE = { public_resource: { limit: 120, ttl: 60_000, blockDuration: 60_000 } };
export const MEDIA_PROXY_THROTTLE = { media: { limit: 20, ttl: 60_000, blockDuration: 300_000 } };
export const AI_BURST_THROTTLE = { ai_burst: { limit: 10, ttl: 60_000, blockDuration: 120_000 } };
export const JOB_APPLICATION_THROTTLE = { job_application: { limit: 3, ttl: 600_000, blockDuration: 1_800_000 } };
export const TEST_CREATE_THROTTLE = { test_create: { limit: 10, ttl: 60_000, blockDuration: 300_000 } };
export const LIBRARY_VIEW_THROTTLE = { library_view: { limit: 30, ttl: 60_000, blockDuration: 300_000 } };

export const DEFAULT_RATE_LIMIT_TRACKER = "anonymous";
const DEFAULT_BACKOFF_MULTIPLIER = 2;

const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const extractHeaderIp = (value?: string | string[]): string | undefined => {
  if (Array.isArray(value)) {
    return extractHeaderIp(value[0]);
  }

  if (!value) {
    return undefined;
  }

  const firstValue = value.split(",")[0]?.trim();
  return firstValue || undefined;
};

export const getClientIp = (req: Record<string, any>): string => {
  return (
    extractHeaderIp(req.headers?.["cf-connecting-ip"]) ||
    extractHeaderIp(req.headers?.["x-real-ip"]) ||
    extractHeaderIp(req.headers?.["x-forwarded-for"]) ||
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    DEFAULT_RATE_LIMIT_TRACKER
  );
};

export const getRateLimitTracker = (req: Record<string, any>): string => {
  const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;
  if (userId) {
    return `user:${userId}`;
  }

  return `ip:${getClientIp(req)}`;
};

export const parsePositiveInt = (
  value: string | number | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export const isSafeHttpMethod = (method?: string): boolean => {
  return SAFE_HTTP_METHODS.has((method || "").toUpperCase());
};

export const parsePositiveFloat = (
  value: string | number | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const calculateBackoffDuration = (
  baseDurationMs: number,
  strikeCount: number,
  multiplier = DEFAULT_BACKOFF_MULTIPLIER,
  maxDurationMs = baseDurationMs,
): number => {
  const normalizedBase = Math.max(1, Math.floor(baseDurationMs));
  const normalizedStrikes = Math.max(0, Math.floor(strikeCount));
  const normalizedMultiplier = Math.max(1, multiplier);
  const normalizedMax = Math.max(normalizedBase, Math.floor(maxDurationMs));

  const duration = normalizedBase * normalizedMultiplier ** normalizedStrikes;
  return Math.min(normalizedMax, Math.floor(duration));
};

export const buildRateLimitBackoffKeys = (rateLimitKey: string) => {
  return {
    strikesKey: `rate-limit:backoff:strikes:${rateLimitKey}`,
    activeBlockKey: `rate-limit:backoff:active:${rateLimitKey}`,
  };
};

const formatDurationPart = (value: number, unit: string): string => {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
};

export const formatRetryAfter = (seconds: number): string => {
  const normalizedSeconds = Math.max(1, Math.ceil(seconds));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const remainingSeconds = normalizedSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(formatDurationPart(hours, "hour"));
  }

  if (minutes > 0 && parts.length < 2) {
    parts.push(formatDurationPart(minutes, "minute"));
  }

  if (remainingSeconds > 0 && parts.length === 0) {
    parts.push(formatDurationPart(remainingSeconds, "second"));
  }

  return parts.join(" ");
};

export const buildRateLimitMessage = (retryAfterSeconds: number): string => {
  return `Too many requests. You are temporarily blocked. Try again in ${formatRetryAfter(
    retryAfterSeconds,
  )}.`;
};

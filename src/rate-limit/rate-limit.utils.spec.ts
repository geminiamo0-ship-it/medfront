import {
  buildRateLimitBackoffKeys,
  buildRateLimitMessage,
  calculateBackoffDuration,
  DEFAULT_RATE_LIMIT_TRACKER,
  formatRetryAfter,
  getClientIp,
  getRateLimitTracker,
  isSafeHttpMethod,
  parsePositiveFloat,
  parsePositiveInt,
} from "./rate-limit.utils";

describe("rate-limit utils", () => {
  describe("getClientIp", () => {
    it("prefers the Cloudflare client IP header", () => {
      const req = {
        headers: {
          "cf-connecting-ip": "198.51.100.10",
          "x-forwarded-for": "203.0.113.9",
        },
      };

      expect(getClientIp(req)).toBe("198.51.100.10");
    });

    it("uses the first forwarded IP when needed", () => {
      const req = {
        headers: {
          "x-forwarded-for": "203.0.113.9, 203.0.113.10",
        },
      };

      expect(getClientIp(req)).toBe("203.0.113.9");
    });

    it("falls back to req.ip and socket addresses", () => {
      expect(getClientIp({ ip: "127.0.0.1" })).toBe("127.0.0.1");
      expect(getClientIp({ socket: { remoteAddress: "10.0.0.1" } })).toBe(
        "10.0.0.1",
      );
    });

    it("returns a stable anonymous value when no address is available", () => {
      expect(getClientIp({})).toBe(DEFAULT_RATE_LIMIT_TRACKER);
    });
  });

  describe("getRateLimitTracker", () => {
    it("uses the authenticated user id when present", () => {
      expect(getRateLimitTracker({ user: { id: 42 }, ip: "127.0.0.1" })).toBe(
        "user:42",
      );
      expect(
        getRateLimitTracker({ user: { userId: 9 }, ip: "127.0.0.1" }),
      ).toBe("user:9");
      expect(getRateLimitTracker({ user: { sub: 7 }, ip: "127.0.0.1" })).toBe(
        "user:7",
      );
    });

    it("falls back to the client IP for anonymous traffic", () => {
      expect(getRateLimitTracker({ ip: "127.0.0.1" })).toBe("ip:127.0.0.1");
    });
  });

  describe("parsePositiveInt", () => {
    it("parses positive numbers and falls back otherwise", () => {
      expect(parsePositiveInt("120", 60)).toBe(120);
      expect(parsePositiveInt(25, 60)).toBe(25);
      expect(parsePositiveInt("0", 60)).toBe(60);
      expect(parsePositiveInt("-1", 60)).toBe(60);
      expect(parsePositiveInt("abc", 60)).toBe(60);
    });
  });

  describe("parsePositiveFloat", () => {
    it("parses positive decimals and falls back otherwise", () => {
      expect(parsePositiveFloat("1.5", 2)).toBe(1.5);
      expect(parsePositiveFloat(2.25, 2)).toBe(2.25);
      expect(parsePositiveFloat("0", 2)).toBe(2);
      expect(parsePositiveFloat("-4", 2)).toBe(2);
      expect(parsePositiveFloat("abc", 2)).toBe(2);
    });
  });

  describe("isSafeHttpMethod", () => {
    it("matches read-only HTTP methods", () => {
      expect(isSafeHttpMethod("GET")).toBe(true);
      expect(isSafeHttpMethod("head")).toBe(true);
      expect(isSafeHttpMethod("OPTIONS")).toBe(true);
      expect(isSafeHttpMethod("POST")).toBe(false);
    });
  });

  describe("calculateBackoffDuration", () => {
    it("keeps the first block at the base duration", () => {
      expect(calculateBackoffDuration(60_000, 0, 2, 3_600_000)).toBe(60_000);
    });

    it("increases exponentially for repeated strikes", () => {
      expect(calculateBackoffDuration(60_000, 1, 2, 3_600_000)).toBe(120_000);
      expect(calculateBackoffDuration(60_000, 2, 2, 3_600_000)).toBe(240_000);
    });

    it("caps the duration at the configured maximum", () => {
      expect(calculateBackoffDuration(60_000, 10, 2, 900_000)).toBe(900_000);
    });
  });

  describe("buildRateLimitBackoffKeys", () => {
    it("creates stable cache keys for strike and active block tracking", () => {
      expect(buildRateLimitBackoffKeys("abc123")).toEqual({
        strikesKey: "rate-limit:backoff:strikes:abc123",
        activeBlockKey: "rate-limit:backoff:active:abc123",
      });
    });
  });

  describe("formatRetryAfter", () => {
    it("formats retry times in a human-readable way", () => {
      expect(formatRetryAfter(45)).toBe("45 seconds");
      expect(formatRetryAfter(60)).toBe("1 minute");
      expect(formatRetryAfter(3660)).toBe("1 hour 1 minute");
    });
  });

  describe("buildRateLimitMessage", () => {
    it("includes the retry duration in the message", () => {
      expect(buildRateLimitMessage(3600)).toBe(
        "Too many requests. You are temporarily blocked. Try again in 1 hour.",
      );
    });
  });
});

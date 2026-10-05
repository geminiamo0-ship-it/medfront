import { createHmac, timingSafeEqual } from "crypto";

type JwtPayload = Record<string, any>;

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64");
}

function parseAudience(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

export function verifyJwtPayload(
  token: string,
  secret: string,
  options?: {
    issuer?: string;
    audience?: string;
  },
): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(base64UrlToBuffer(encodedHeader).toString("utf8"));
    if (header?.alg !== "HS256" || header?.typ !== "JWT") {
      return null;
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(signingInput)
      .digest();
    const actualSignature = base64UrlToBuffer(encodedSignature);
    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return null;
    }

    const payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString("utf8"));
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload?.exp === "number" && payload.exp < now) {
      return null;
    }
    if (typeof payload?.nbf === "number" && payload.nbf > now) {
      return null;
    }
    if (options?.issuer && payload?.iss !== options.issuer) {
      return null;
    }
    if (options?.audience) {
      const audiences = parseAudience(payload?.aud);
      if (!audiences.includes(options.audience)) {
        return null;
      }
    }

    return payload;
  } catch {
    return null;
  }
}

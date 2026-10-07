import { MEDIA_CDN } from './env';

/**
 * Some imported question and article records still contain absolute URLs for
 * older MedPark storage hosts. Keep stored source HTML unchanged and swap only
 * the *origin* at the boundary, retaining the exact object key and query.
 *
 * A host boundary is required: storage.blablabl234a.online.evil.tld must never
 * be treated as one of our historic storage hosts.
 */
const LEGACY_MEDIA_ORIGIN = /(?:https?:)?\/\/(?:storage\.blablabl234a\.online|storage-public\.medpark\.io)(?=\/|[?#\s"'<>]|$)/gi;
const R2_ORIGIN = MEDIA_CDN.replace(/\/$/, '');

export function rewriteLegacyMediaUrls(value: string): string {
  return value.replace(LEGACY_MEDIA_ORIGIN, R2_ORIGIN);
}

/**
 * All authenticated JSON API payloads pass through this adapter after decrypt.
 * This covers nested question stems, options, explanations, library articles,
 * hover/overlay URLs and future themes without scattering bank-specific rules.
 *
 * Preserve object identities for response subtrees with no legacy URLs.
 */
export function rewriteMediaUrlsInResponse<T>(value: T): T {
  if (typeof value === 'string') {
    return rewriteLegacyMediaUrls(value) as T;
  }

  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((entry) => {
      const result = rewriteMediaUrlsInResponse(entry);
      if (result !== entry) changed = true;
      return result;
    });
    return (changed ? mapped : value) as T;
  }

  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }

  let changed = false;
  const mapped: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const result = rewriteMediaUrlsInResponse(entry);
    if (result !== entry) changed = true;
    mapped[key] = result;
  }

  return (changed ? mapped : value) as T;
}

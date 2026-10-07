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
 * Imported content can use document-relative offline_media keys, e.g.
 * <img src="offline_media/example.jpg">. Browsers otherwise resolve them
 * against /test/:id or /library rather than the public media bucket.
 *
 * Only this known namespace is mapped; ordinary navigation, third-party
 * URLs and fragment links retain their meaning.
 */
export function rewriteRelativeOfflineMediaUrl(value: string): string {
  const match = /^(?:\.\/|\/)?(offline_media\/[^?#\s"'<>\\]+)(\?[^#\s"'<>]*)?(#[^\s"'<>]*)?$/i.exec(value.trim());
  if (!match) return value;

  // Reject traversal-like keys instead of normalizing them onto the bucket.
  if (match[1].split('/').some((segment) => segment === '.' || segment === '..')) return value;
  return MEDIA_CDN + match[1] + (match[2] ?? '') + (match[3] ?? '');
}

/** srcset may contain widths and multiple candidates; keep other entries intact. */
export function rewriteRelativeOfflineMediaSrcset(value: string): string {
  return value.replace(
    /(^|,\s*)((?:\.\/|\/)?offline_media\/[^\s,]+)(?=\s|,|$)/gi,
    (_whole, separator: string, url: string) =>
      separator + rewriteRelativeOfflineMediaUrl(url),
  );
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
    return rewriteRelativeOfflineMediaUrl(rewriteLegacyMediaUrls(value)) as T;
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

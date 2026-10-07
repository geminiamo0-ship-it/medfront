import DOMPurify, { type Config } from 'dompurify';
import { rewriteLegacyMediaUrls, rewriteRelativeOfflineMediaUrl, rewriteRelativeOfflineMediaSrcset } from './media';

/**
 * Sanitizer for all server-provided HTML (library articles, question
 * explanations, AI summaries, notebook content). Even though the content comes
 * from our own API, a bad import or compromised admin could turn stored HTML
 * into code running with the user's JWT. Policy mirrors the recovered library
 * page so behaviour is identical.
 */
const RICH_HTML_POLICY = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
  FORBID_TAGS: [
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'textarea',
    'select',
    'option',
    'meta',
    'base',
    'link',
  ],
  FORBID_ATTR: ['srcdoc', 'formaction'],
  ADD_ATTR: ['target'],
  ALLOW_DATA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  KEEP_CONTENT: true,
} as const;

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (
    data.attrName === 'style' &&
    /(?:url\s*\(|expression\s*\(|behavior\s*:|-moz-binding)/i.test(data.attrValue || '')
  ) {
    data.keepAttr = false;
  }
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Images supplied by imports often carry bare offline_media/... keys.
  // Resolve only those trusted relative media paths after DOMPurify has
  // validated attributes; never change other links or weaken sanitization.
  for (const attribute of ['src', 'data-src', 'data-original', 'poster', 'href']) {
    const original = node.getAttribute(attribute);
    if (original) {
      const rewritten = rewriteRelativeOfflineMediaUrl(original);
      if (rewritten !== original) node.setAttribute(attribute, rewritten);
    }
  }
  const srcset = node.getAttribute('srcset');
  if (srcset) {
    const rewritten = rewriteRelativeOfflineMediaSrcset(srcset);
    if (rewritten !== srcset) node.setAttribute('srcset', rewritten);
  }
  if (node.nodeName === 'A' && (node.getAttribute('target') || '').toLowerCase() === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function safeRichHtml(value: unknown): string {
  return DOMPurify.sanitize(
    rewriteLegacyMediaUrls(String(value ?? '')),
    RICH_HTML_POLICY as unknown as Config,
  ) as string;
}

/** Strip all tags — for plain-text contexts (e.g. search result titles). */
export function stripHtml(value: unknown): string {
  return DOMPurify.sanitize(String(value ?? ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
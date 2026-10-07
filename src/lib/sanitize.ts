import DOMPurify, { type Config } from 'dompurify';
import { rewriteLegacyMediaUrls } from './media';

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
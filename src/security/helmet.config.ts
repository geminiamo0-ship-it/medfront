import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

/**
 * Shared Helmet configuration used by both the Express bootstrap (`main.ts`)
 * and the Cloudflare Worker bootstrap (`worker.ts`). Centralizing this means
 * the two entry points can never drift apart on security headers.
 *
 * Notes on each directive:
 *  - CSP is intentionally permissive on `unsafe-inline` for now because the
 *    frontend bundle still ships inline styles via React's `style={...}` and
 *    `dangerouslySetInnerHTML`. Once those are migrated to nonces we can
 *    tighten this. Scripts are restricted to same-origin — no inline scripts
 *    accepted.
 *  - `frame-ancestors 'none'` plus `X-Frame-Options: DENY` blocks clickjacking
 *    on every page the API serves (relevant for the OAuth callback path and
 *    Swagger UI, which are HTML responses).
 *  - HSTS is enabled with a 1-year max-age. Cloudflare already enforces TLS,
 *    so this is belt-and-suspenders for any direct-to-origin requests that
 *    bypass the CDN.
 *  - `crossOriginEmbedderPolicy` is disabled because we still serve some
 *    cross-origin images (Google Cloud Storage, etc.) without COEP headers.
 */
// Paths that need a permissive CSP because they ship inline scripts/styles
// that we don't control. Currently only Swagger UI. Helmet still sends every
// OTHER security header (HSTS, X-Frame-Options, nosniff, Referrer-Policy,
// hidePoweredBy) on these paths — we only opt them out of CSP.
const PATHS_WITHOUT_CSP = ['/mrshady/api/docs'];

const buildStrictHelmet = () =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        // Scripts: only from this origin. No inline, no eval.
        scriptSrc: ["'self'"],
        // Styles: same-origin plus inline (React's runtime styles).
        // Tighten when components migrate to CSS modules / nonced styles.
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Images: same-origin, data URIs (notebook inline previews),
        // and any https source (admin-imported question images).
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        // Media: question videos, often on https CDNs.
        mediaSrc: ["'self'", 'https:'],
        // XHR / fetch / WebSocket targets. The frontend talks to the API
        // origin; allow https: so admin-side previews can hit Google Cloud
        // Storage and other media hosts.
        connectSrc: ["'self'", 'https:'],
        // Defense-in-depth on clickjacking.
        frameAncestors: ["'none'"],
        // Plugins like Flash are dead, but disallow explicitly.
        objectSrc: ["'none'"],
        // Upgrade any accidental http:// references to https://.
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  });

// Same set of headers MINUS the CSP block. Used for Swagger UI and any
// other docs path that ships its own inline scripts.
const buildHelmetWithoutCsp = () =>
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  });

export function applyHelmet(app: INestApplication): void {
  const strict = buildStrictHelmet();
  const lax = buildHelmetWithoutCsp();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const needsLax = PATHS_WITHOUT_CSP.some((prefix) =>
      (req.path || '').startsWith(prefix),
    );
    if (needsLax) {
      lax(req, res, next);
    } else {
      strict(req, res, next);
    }
  });
}

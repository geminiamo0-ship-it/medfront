# Global Media Origin — canonical public R2 (2026-10-08)

**Approval:** user explicitly required one replacement across the **entire website**, not AMBOSS only. Implemented under Issue #32 (separate from the AMBOSS sidebar design approval in Issue #4).

## Canonical origin
`https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/`

Legacy source hosts found in the code:
- `storage.blablabl234a.online`
- `storage-public.medpark.io` (historic media-proxy allowlist)

This is a **base-origin migration**, not a request to rename/reupload objects or rewrite unrelated domains. Preserve everything after the host: `/offline_media/<filename>` and query strings.

## Current runtime behavior
- `src/lib/env.ts` defines `MEDIA_CDN` with the new origin for all new relative media links.
- `src/lib/media.ts` replaces *absolute legacy media origins* inside nested API response data after decrypt, so it works for all question banks and all future themes, Library, options, explanations, previews, notes and any other API content.
- `safeRichHtml` also remaps historic absolute origins before DOMPurify sanitization (including content passed in through non-API paths).
- The existing library `fixImageUrls`, `fixOfflineMedia`, inline illustrations and overlays inherit the new `MEDIA_CDN`.
- The canonical backend `medhvgg/src/media/media-proxy.controller.ts` validates requested hosts and fetches all accepted legacy/new object paths **from new R2**. Old proxy query URLs remain compatible; no old host is fetched. Unrelated hosts, insecure schemes, custom ports remain rejected.
- No destructive DB migration is performed: stored source HTML, questions and existing submissions stay unchanged.

## Verification contract
- Frontend `Verify`: typecheck, lint, production build.
- AMBOSS Chromium smoke: nested question/option URLs from *both* historic hosts rewrite to R2; unrelated external URLs stay unchanged. Same central transport also serves every other page/theme.
- Backend `Verify`: TypeScript/build/tests; `media-url.util.spec.ts` verifies origin, path/query preservation and SSRF host restrictions.
- **Separate gate**: verify a representative actual object `/offline_media/<real filename>` returns HTTP 200 and the correct image MIME type from the newly supplied R2. A successful code deploy cannot prove bucket contents/permissions; do not mark this check green without real HTTP evidence.

## Scope guard
This change does **not** replace the API origin, logos/site static assets, auth, answer data, or unrelated third-party URLs.

## Sidebar design
Issue #4 separately records user approval of the AMBOSS sidebar screenshot reconstruction (question-stem snippets, progress bar, status/hammers/marks, session/question timers); do not confuse that approved UI task with this global media migration.


## Release evidence — 2026-10-08

Global media migration code merged and deployed:
- Backend `medhvgg` PR #29 → `e3c8724b9710f452c29f6a2fad8c53b9bd00eb7d`, Verify #33 success, Railway deployment `b2ba2947-bcd3-479b-a7c4-f8686b9856f5` SUCCESS.
- Frontend `medfront` PR #33 → `73f698399b268d09ad7bdacfe5b4911f93446210`, main Verify run `37697789982` success, AMBOSS Browser Smoke #36 `global_r2_media_origin=true`, Cloudflare Workers Version `e502ebae-4b16-4aea-bba8-1bc80b80a777` SUCCESS.

**Not yet proven:** specific actual image objects are uploaded under the same keys and anonymously accessible via the new public R2 URL with proper MIME/CORS. A working frontend/CDN origin does not establish object existence. Verification requires checking the response of a known real media filename from this public R2 host.


## Relative-key regression follow-up — 2026-10-08 (Issue #32 reopened)

A real AMBOSS screenshot contains a broken image with a bare `src="offline_media/ihg_681237c83e6287_31701899.jpg"`. The initial global migration covered legacy **absolute** storage URLs but the shared HTML sanitizer did not resolve relative `offline_media/` keys. Browsers thus requested images from the app route instead of R2.

**Focused contract-only correction (branch `fix/global-relative-r2-media`):**
- `src/lib/media.ts` maps only direct known relative `offline_media/` keys (plus `./` or `/` prefixes) to the canonical public R2 origin, preserving filenames/query/fragment and leaving other links/hosts alone;
- `src/lib/sanitize.ts` maps such keys on sanitized HTML media-related attributes, including `src`, `srcset`, `data-src`, `poster`, `href`;
- Central API response remapping also covers standalone relative media-path strings.
- Browser smoke adds real `img` elements to a test stem and option, asserts their resolved DOM `src`, and serves a **mocked** 1×1 image to prove browser decoding. This does **not** verify the real R2 bucket's object existence.

**Verification status:** PR #37 merged to `main` as `daeb1b1d0b1a3ed095f8070d9e39c8b22de57821`. Verify #140 ✅, AMBOSS Browser Smoke #42 ✅ (`relative_r2_images=true`), and merge main Verify run `37700603674` ✅. Cloudflare production deployment of this merge remains unconfirmed. The public-object GitHub Actions probe #1 returned **HTTP 404 / `text/html`** for the screenshot's `offline_media/ihg_681237c83e6287_31701899.jpg`; therefore this real object is **not verified available**. It may require upload or key/path correction. Other bucket objects have not been assessed. Existing DB content is not modified.


**External evidence:** [Public R2 Media Availability run #1](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37700441479) runs on a network-enabled GitHub Actions runner. Its workflow step succeeds informationally while emitting a warning for non-200/non-image MIME; a green *workflow* **does not** imply media availability. The browser smoke mocks the R2 media response intentionally, so its green result proves URL normalization, not bucket contents.

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

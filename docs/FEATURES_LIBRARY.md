# Features — Library

Route: `/library` · Main file: `src/pages/library/LibraryPage.tsx` · Styles: `src/pages/library/library.css`

A full-screen reader with its own header (outside `AppLayout`), a category tree sidebar, Amboss-style presentation modes, and study tooling.

## Delivery phases

| Phase | Scope |
|---|---|
| **L-A** | Scoped + recolored CSS, own header, sidebar category tree, article reader in React |
| **L-B** | In-article search (highlight matches + navigate), image lightbox with zoom/download |
| **L-C** | Highlights and annotation tools — pencil, highlighter, eraser, laser pointer, undo/redo — extracted into `useAnnotations.ts` |
| **L-D** | Notebook drawer (resizable, rich text, insert-article, PDF export) + AI summary panel |
| **L-E** | Amboss mode: answer cards, key-exam mode, toggle-all, term popovers, image viewer + hover cards, split screen, dark-mode content stripping, article scroll fixes |

Later additions: learning tips as popovers with a 16×16 learning-card badge, cross-reference navigation that jumps to an anchor without refetching, per-source structure caching + dedupe with TanStack Query, HTTP 423 lock handling with retry, and dark mode fixes (preserve coloured spans, readable key-exam highlights, stop the broad `*:not(mark)` rule from wiping callout backgrounds).

## Components

`LibraryPage.tsx` was reduced from 1925 to 1146 lines by extracting (no behaviour change):

`LibraryNavbar` · `LibrarySidebar` · `CategoryNode` · `SplitPane` · `AiSummaryPanel` · `NotebookDrawer` · `Lightbox` · `AmbossImageViewer` · `AmbossPopover` · `AmbossToolbar` · `ImageHoverCard` · `Toast` · `useAnnotations` (hook) · `amboss.ts` + `utils.ts` (pure helpers)

## High-yield toggle — the important rule

The High-yield button hides condensed exam-focus content. The correct implementation is **inline spans only, via `display: none`**:

```css
/* library.css */
.library-root.show-high-yield span.condensed-hidden,
.library-root.show-high-yield span.condensed-hidden-step1,
.library-root.show-high-yield span.condensed-hidden-step2 {
  display: none !important;
}
```

Rules that must not be broken:

- **Hide, never fade.** Earlier attempts used opacity/spotlight effects; that was reverted because it left content visible in the wrong way. Keep `display: none`.
- **Never hide block wrappers.** Some sections carry `condensed-*` classes on their *wrapper* (`<ul class="condensed-hidden-step2">` around a whole section, `<div class="table-wrapper condensed-hidden-step2">`, `<h2 class="condensed-hidden">`). Matching only `span` selectors keeps those sections visible.
- Mnemonics and tables stay readable; only mid-sentence detail spans disappear.
- `Process` spans are intentionally hidden (they are exam-irrelevant extras).

## List markers

Tailwind Preflight removes list markers, so `library.css` re-declares them explicitly:

```css
#acon ul { list-style: disc; }
#acon ol { list-style: decimal; }
#acon ul ul { list-style: circle; }
#acon ul ul ul { list-style: square; }

.amboss-card-body ul { list-style: disc; }
.amboss-card-body ol { list-style: decimal; }
.amboss-card-body ul ul { list-style: circle; }
.amboss-card-body ul ul ul { list-style: square; }
```

## Amboss-style interactive links

`.api`, `.dictionary` and `.linksuggest` are styled as Medical Interactive Links (blue, underlined on hover) at `library.css:380+`, with dark-mode/key-exam variants below. There is a known open question: the High-yield rule currently also hides API links that carry a `condensed-hidden*` class, whereas the reference implementation keeps them visible — tracked in [ROADMAP.md](ROADMAP.md).

## Data & caching

- Structure comes from `src/api/library.ts` with per-source caching and dedupe through TanStack Query.
- HTTP 423 (locked source) is handled with a friendly panel and a retry path rather than an error.
- Article/annotation persistence uses `useAnnotations` + `src/api/library.ts`; notes live in `src/api/notebook.ts`.

## Loading

The sidebar structure loader and the article pane both use the shared heartbeat loader — see [UI_LOADING_SYSTEM.md](UI_LOADING_SYSTEM.md).
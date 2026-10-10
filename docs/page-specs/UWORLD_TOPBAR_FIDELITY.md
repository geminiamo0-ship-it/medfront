# UWorld V3 toolbar fidelity — incremental stage 1 of 3

Approved by user on 2026-10-10, issue #67, with **two original/reference bars and current implementation** screenshots in chat. Implement **Topbar only**. Next are Bottom Bar then Question Navigator, after user visually approves each stage. Parent baseline `UWorld V3` in issue #64 and `UWORLD_V3_THEME.md` remain valid.

## Visual acceptance
- Match screenshot geometry, not a generic exam navbar. Fixed **48px topbar** desktop, body below. Left: narrow hamburger, two-line **Item X of N / Question Id**, compact flag and **Mark** immediately beside ID; icon and text white on themed bar.
- Middle: **Previous / Next exactly centered** with small filled directional triangular silhouettes and 9-10px labels, same visual baseline as right icons, no overlap with left/right.
- Right: **Shortcuts → Full Screen → Marker → Lab Values → Notes → Calculator → Settings**, each a consistent SVG ~20–23px with clear **9–10px** label. The current `.uw-runner button { font: inherit }` overrides `.uw-bar-action` font-size. Correct **only** the topbar with stronger scoped selector; don't change all buttons and break the bottom bar.
- Respect Blue (default), Sepia, Dark CSS vars. Mark status and selected marker remain clear. All actions retain existing callbacks/permission semantics.
- At 1250/900/mobile 390/320: preserve center alignment in available bar area; mobile hides optional labels to avoid collision, preserves Previous/Next and mark, accessible aria labels; no horizontal overflow. Tool order and routes untouched.
- Original icon shapes tailored in a **small theme-local icon file**, not overriding AMBOSS/shared icon definitions. Keep reusable SVG assets within React, no external font or icon library. Avoid setting literal width/height on every icon independently.

## Code and test boundaries
- Only `UWorldTopbar.tsx`, `UWorldTopbarIcon.tsx`, `styles/uworld-topbar.css`, `styles/uworld-responsive.css` topbar rules, `uworld.css` stylesheet index, and browser smoke/topbar docs. Single-responsibility files; architecture guard still enforced. `--uw-top` can be set in scoped UWorld CSS for matching height; downstream body position is a dependent layout, not a redesign.
- Browser geometry measurements: center offset of Previous/Next container from bar center ≤ 8px on 1440/1280/834/390; label computed font size ≤11px on desktop; no overlap with Mark, tool group or viewport; checks icon labels and order; preserve existing Tutor/Timed tests and AMBOSS regression. Save screenshots for user review.
- Merge only after all GitHub Actions pass and user review of screenshot; no Cloudflare live claim based on mocks.

## Mobile revision — user-approved 2026-10-10
User explicitly replaces the previous mobile clipping/hide approach with a bespoke premium mobile toolbar. Desktop arrangement must stay screenshot-faithful and unchanged.

- Under 650px, primary fixed exam bar shows **Previous**, **Next**, **Mark**, and **Settings** as the 4 direct study actions. The narrow menu + question index stays left for orientation/question-list navigation; **Mark is moved to the right primary action pair only on mobile** to avoid duplicate buttons.
- **Settings** is a toggle, NOT the appearance drawer on first tap. Its button opens/closes a full-width tool **tray dropping immediately below the fixed topbar**, smooth 200–300ms transform/opacity animation plus subtle backdrop-shadow; no page reflow or question-position shift. A second tap or outside click or Escape closes. Reduced-motion preference disables animation.
- Tray contains all remaining topbar actions: **Shortcuts, Full Screen, Marker, Lab Values, Notes, Calculator**, and **Appearance & Layout** which opens the existing full settings panel. Icons and small readable labels, touch targets 44px; responsive grid/single horizontal row as space permits, rounded themed surface, keyboard accessibility and focus return, `aria-expanded`/`aria-controls`.
- The desktop tools bar remains exactly seven inline icons, with desktop Settings opening the existing appearance panel directly. Blue(default), Sepia, Dark use existing theme variables. Prevent simultaneous navigator overlay and mobile tray.
- Keep UWorld UI small and modular: `UWorldMobileTools.tsx` for tray, CSS in separate `styles/uworld-mobile-tools.css`, Topbar only wires state/handlers. No mutations, backend or shared engine changes.
- Update UWorld Chromium: 390 and 320 primary layout and drawer open → choose tool → close, Settings → Appearance, Escape/outside close, no overlap/overflow, screenshot **expanded and collapsed**, tablet and desktop remain unchanged. No merge before user approves screenshots.

## Mobile revision 2 — right-edge vertical radial rail, 2026-10-10
User **rejected the horizontal, full-width dropdown after seeing screenshots** and requests a vertical, side-mounted floating column of **circular tool icons**, unfurling downward from the Settings gear. This supersedes *only* the Mobile revision's full-width tray/grid instructions; all other requirements remain unchanged.

- At phone widths <=650px, primary row still Previous/Next/Mark/Settings plus narrow question identity/navigation. Tapping Settings rotates the gear ~90deg, and a **small floating right-edge vertical rail opens downward from directly beneath the Settings icon**; it **does not stretch across viewport** and does not reflow stem or move the fixed bars.
- Each tool is a clearly circular ~44–48px control, tiny label beneath the icon for discovery; order: Shortcuts, Full Screen, Marker, Lab Values, Notes, Calculator, Appearance & Layout. A light translucent capsule/connector may group them but the circles are visually distinct.
- Premium animation: 220–320ms spring-like downward rail reveal, individual icons appear in a subtle top-to-bottom stagger; reverse on close. Settings SVG rotates 90deg on open. Respect reduced-motion.
- Side rail anchors to the gear's right edge with 8px screen clearance and obeys `max-height` based on viewport height to scroll safely on short devices. No horizontal overflow at 320/390, no obscured controls when opening tools, no accidental exam answer selection.
- A second Settings tap, Escape, outside pointer and tool selection close. On choosing Appearance & Layout open existing Settings panel, not another modal inside the rail. Keep Blue/Sepia/Dark.
- Only modify isolated UWorld mobile rail component/style + Topbar state wiring and browser smoke. Desktop and AMBOSS, Bottom Bar, Sidebar and shared controller untouched. Preserve open draft PR #68 until user confirms **vertical circular** screenshot.

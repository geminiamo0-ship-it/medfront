# QBank Workspace Shell — Page Spec

**Issue:** #11  
**Parent:** #3 / #1  
**Status:** SPEC APPROVED → IMPLEMENTING  
**Route(s):** `/qbank/:bankId/*`  
**Last updated:** 2026-10-05  
**User approval:** Approved from runtime screenshot/discussion on 2026-10-05

## 1. Purpose

Provide a dedicated QBank workspace shell for a selected bank without competing with the global MedPark application header, while making the workspace premium and usable across desktop, tablet/iPad and mobile.

## 2. Evidence reviewed

- User-supplied runtime screenshot showing the global MedPark navigation (`Home / Dashboard / Contests / Library`) rendered above the bank-specific QBank workspace.
- `src/router.tsx`: `/qbank/:bankId` is currently nested under `AppLayout`.
- `src/components/layout/AppLayout.tsx`: global header is always rendered for its child routes.
- `src/pages/qbank/QbankWorkspace.tsx`: QBank already renders its own sidebar and sticky workspace header.

### Root cause

The overlap is architectural, not cosmetic: the QBank workspace is mounted inside the global application shell even though it already owns a second navigation shell. The fix is to route the selected-bank workspace outside `AppLayout`, while keeping it protected by `ProtectedRoute`.

## 3. Approved visual/interaction direction

- A selected QBank owns its own workspace shell.
- Do not render the global MedPark header above `/qbank/:bankId/*`.
- Keep the existing dark QBank sidebar on desktop.
- On viewport widths below the desktop breakpoint, the sidebar becomes an off-canvas drawer.
- A visible workspace menu button opens the drawer on tablet/iPad/mobile.
- Drawer has an overlay, close button, Escape support, and closes after selecting a navigation item.
- Background page scroll is locked while the mobile/tablet drawer is open.
- The workspace header remains compact and sticky.
- Main content uses viewport-aware padding and must not horizontally overflow.
- Keep current QBank branding and visual language; this slice is shell/responsive polish, not a rebrand.

## 4. Responsive behavior

### Desktop (`lg` and above)
- Sidebar remains fixed at the left at the current approximate width.
- Main workspace content is offset by the sidebar width.
- Workspace header spans only the workspace content area.
- Sidebar remains visible without a drawer overlay.

### Tablet / iPad / mobile (below `lg`)
- No permanent left offset.
- Sidebar is translated off-canvas until opened.
- Workspace header shows a menu button.
- Opening the menu reveals the QBank sidebar above a dimmed overlay.
- Tapping the overlay, pressing Escape, tapping Close, or navigating to a QBank section closes the drawer.
- Header title truncates safely if necessary.
- Home/back-to-banks remains reachable without consuming excessive width.
- Main content padding becomes compact on phones and grows at `sm`/`lg`.

## 5. Navigation ownership

### QBank list
`/qbank` remains inside the normal MedPark `AppLayout` because it is a global application page for selecting a bank.

### Selected bank workspace
`/qbank/:bankId/*` is protected independently and renders `QbankWorkspace` directly, outside `AppLayout`.

### Child routes
- `/qbank/:bankId` → Welcome
- `/qbank/:bankId/create-test` → Create Test
- `/qbank/:bankId/previous-tests` → Previous Tests

The current query-string Step behavior is preserved.

## 6. Accessibility

- Drawer open button has an accessible label.
- Drawer close button has an accessible label.
- Drawer exposes `aria-hidden`/visibility behavior through actual rendered state/classes rather than color only.
- Escape closes the drawer.
- Overlay is keyboard-neutral and click dismissible.
- Navigation uses links/buttons with normal focus behavior.
- No horizontal overflow should make controls unreachable by keyboard or touch.

## 7. Performance/state

- Drawer state is local UI state only.
- No extra backend request is introduced by the responsive shell.
- Existing QBank query/cache behavior remains unchanged.
- Navigation must close the drawer without forcing a page reload.

## 8. Create Test responsive scope tied to this shell slice

Create Test keeps its existing product behavior and receives a responsive layout pass:
- Question Mode heading and Standard/Custom toggle fit narrow screens.
- Status modes use touch-friendly wrapping/stacking.
- Difficulty, Subjects, Systems, Topics remain usable without horizontal overflow.
- Topic-search dropdown/panel is constrained to the viewport on phones.
- Custom retrieve input/button stack where necessary.
- Standard `Questions`, `Available`, Tutor/Timed and Create controls stack cleanly on narrow screens.
- Standard maximum remains 50.
- Custom maximum remains 50.
- Mixed, availability and metadata-stability behavior remain unchanged.

## 9. Explicit non-goals

- No Library mobile/tablet redesign in this slice. The user explicitly deferred Library responsive work until a separate detailed UX discussion.
- No Exam Runner implementation.
- No backend contract changes.
- No full redesign of Welcome/Previous Tests beyond shell compatibility needed by this change.
- No global MedPark responsive redesign in this issue beyond the new cross-page verification rule.

## 10. Acceptance criteria

- [ ] `/qbank/:bankId/*` no longer renders inside `AppLayout`.
- [ ] Global MedPark header is absent inside selected-bank workspace pages.
- [ ] `/qbank` bank-selection page still renders in `AppLayout`.
- [ ] Desktop QBank sidebar remains fixed and usable.
- [ ] Tablet/iPad/mobile sidebar is off-canvas with menu trigger.
- [ ] Drawer closes by Close button, overlay, Escape and section navigation.
- [ ] Body scroll is locked while drawer is open.
- [ ] Workspace header and content have no horizontal overflow at phone/tablet widths.
- [ ] Create Test is usable at desktop, tablet/iPad and mobile widths.
- [ ] Create Test product behavior remains unchanged except responsive presentation.
- [ ] Typecheck, lint, production build and GitHub Actions `Verify` pass.
- [ ] Browser verification covers desktop, tablet/iPad and mobile.

## 11. Verification plan

### Source/CI
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- GitHub Actions `Verify`

### Browser/manual
Runtime: `https://medfront.geminiamo0.workers.dev`

Verify approximately:
- desktop ≥1280px;
- iPad/tablet ~768–1024px;
- mobile ~360–430px.

Check:
- shell ownership/no duplicate global header;
- drawer open/close paths;
- no horizontal overflow;
- Create Test Standard and Custom layout;
- Questions/Available/Create row;
- Systems/Topics and topic-search behavior.

## 12. Approval record

2026-10-05 — User explicitly approved:
- removing the confusing global/QBank navigation overlap;
- dedicated QBank workspace behavior;
- responsive/collapsible sidebar for mobile/tablet/iPad;
- premium responsive treatment of Create Test;
- making responsive viewport coverage part of page work going forward;
- deferring Library mobile/tablet work until a later detailed discussion.
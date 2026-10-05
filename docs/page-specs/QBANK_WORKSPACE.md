# QBank Workspace Shell — Page Spec

**Issue:** #11  
**Parent:** #3 / #1  
**Status:** VERIFYING  
**Route(s):** `/qbank/:bankId/*`  
**Last updated:** 2026-10-05  
**User approval:** Approved from runtime screenshot/discussion on 2026-10-05

## 1. Purpose

Provide a dedicated QBank workspace shell for a selected bank without competing with the global MedPark application header, while making the workspace premium and usable across desktop, tablet/iPad and mobile.

## 2. Evidence reviewed

- User-supplied runtime screenshot showing the global MedPark navigation (`Home / Dashboard / Contests / Library`) rendered above the bank-specific QBank workspace.
- `src/router.tsx`: `/qbank/:bankId` was nested under `AppLayout`.
- `src/components/layout/AppLayout.tsx`: global header is always rendered for its child routes.
- `src/pages/qbank/QbankWorkspace.tsx`: QBank already renders its own sidebar and sticky workspace header.
- Runtime screenshot on 2026-10-05 showing `/qbank/39/create-test` without `?step=` resolving as Step 1 and rendering `Bank not found`.
- `WelcomePage.tsx` and `PreviousTestsPage.tsx` contained Create Test links that did not preserve the workspace Step context.

### Root causes

1. The original shell overlap was architectural: the QBank workspace was mounted inside the global application shell even though it already owned a second navigation shell.
2. Some workspace navigation paths dropped the `step` query parameter. `QbankWorkspace` then defaulted missing Step context to Step 1, causing valid banks from other steps to be treated as missing.

The shell fix is structural, not cosmetic. The Step fix is both preventative and recoverable: internal links preserve Step, and legacy/bookmarked selected-bank URLs without a valid Step recover the bank's canonical Step from the active QBank catalogue and repair the URL.

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
- Sidebar is off-canvas until opened.
- Workspace header shows a menu button.
- Opening the menu reveals the QBank sidebar above a dimmed overlay.
- Tapping the overlay, pressing Escape, tapping Close, or navigating to a QBank section closes the drawer.
- Header title truncates safely if necessary.
- Back-to-banks remains reachable without consuming excessive width.
- Main content padding becomes compact on phones and grows at `sm`/`lg`.

## 5. Navigation ownership and Step integrity

### QBank list
`/qbank` remains inside the normal MedPark `AppLayout` because it is a global application page for selecting a bank.

### Selected bank workspace
`/qbank/:bankId/*` is protected independently and renders `QbankWorkspace` directly, outside `AppLayout`.

### Child routes
- `/qbank/:bankId` → Welcome
- `/qbank/:bankId/create-test` → Create Test
- `/qbank/:bankId/previous-tests` → Previous Tests

### Step rules
- Normal bank entry from `/qbank` includes `?step=N`.
- All QBank sidebar navigation preserves `?step=N`.
- Welcome → Create Test and Previous Tests → Create Test preserve `?step=N` explicitly.
- If a legacy/bookmarked selected-bank URL has no valid `step`, `QbankWorkspace` may call the existing all-active-banks metadata path once, find the requested bank by ID, derive its canonical `bank.step`, persist it, and replace the URL with `?step=<canonical>`.
- The missing-Step recovery must not change backend domain rules or bypass access/locking.

## 6. Accessibility

- Drawer open button has an accessible label.
- Drawer close button has an accessible label.
- Escape closes the drawer.
- Overlay is click dismissible.
- Navigation uses links/buttons with normal focus behavior.
- No horizontal overflow should make controls unreachable by keyboard or touch.
- Step recovery is transparent navigation repair and does not require a separate interactive control.

## 7. Performance/state

- Drawer state is local UI state only.
- Normal valid-Step navigation keeps the existing step-scoped QBank metadata request.
- Missing/invalid-Step recovery uses the existing `getQuestionBanks()` unscoped catalogue request only for the malformed/legacy URL case; it does not add an extra request to normal navigation.
- Navigation must close the drawer without forcing a page reload.
- URL correction uses history replacement rather than adding a duplicate browser-history entry.

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
- No full redesign of Welcome/Previous Tests beyond shell compatibility and Step-safe navigation needed by this change.
- No global MedPark responsive redesign in this issue beyond the new cross-page verification rule.

## 10. Acceptance criteria

- [x] `/qbank/:bankId/*` no longer renders inside `AppLayout` in source.
- [x] `/qbank` bank-selection page remains in `AppLayout` in source.
- [x] Desktop QBank sidebar remains fixed in source.
- [x] Tablet/iPad/mobile sidebar is off-canvas with menu trigger in source.
- [x] Drawer closes by Close button, overlay, Escape and section navigation in source.
- [x] Body scroll lock is implemented while drawer is open.
- [x] Workspace navigation preserves Step context in source.
- [x] Welcome → Create Test preserves Step context.
- [x] Previous Tests empty-state → Create Test preserves Step context and targets the sibling route correctly.
- [x] Missing/invalid-Step selected-bank URLs recover canonical Step from the bank metadata catalogue and repair the URL in source.
- [x] Create Test responsive source pass implemented for desktop/tablet/mobile.
- [ ] Deployed runtime confirms global MedPark header is absent inside selected-bank workspace pages.
- [ ] Runtime confirms a bare legacy URL such as `/qbank/<valid-bank-id>/create-test` self-recovers instead of showing false `Bank not found`.
- [ ] Runtime confirms normal Step-preserving Welcome/Create Test/Previous Tests navigation.
- [ ] Browser verification covers desktop, tablet/iPad and mobile.
- [ ] Typecheck, lint, production build and GitHub Actions `Verify` pass on latest head.

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
- Systems/Topics and topic-search behavior;
- Step stays in the URL across Welcome/Create Test/Previous Tests;
- deliberately remove `?step=` from a known valid bank URL and confirm the workspace repairs it to the correct Step instead of showing false `Bank not found`.

## 12. Approval/runtime record

2026-10-05 — User explicitly approved:
- removing the confusing global/QBank navigation overlap;
- dedicated QBank workspace behavior;
- responsive/collapsible sidebar for mobile/tablet/iPad;
- premium responsive treatment of Create Test;
- making responsive viewport coverage part of page work going forward;
- deferring Library mobile/tablet work until a later detailed discussion.

2026-10-05 — User then supplied runtime evidence that some banks, especially Create Test, could show `Bank not found`. The screenshot URL lacked `?step=`, and source inspection confirmed two Create Test links could drop Step context. The remediation above was implemented as part of Issue #11 rather than being deferred.
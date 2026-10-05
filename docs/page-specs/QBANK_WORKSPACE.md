# QBank Workspace Shell — Page Spec

**Issue:** #11  
**Parent:** #3 / #1  
**Status:** VERIFYING  
**Route(s):** `/qbank/:bankId/*`  
**Last updated:** 2026-10-06  
**User approval:** Approved from runtime screenshot/discussion on 2026-10-05; Step-root behavior approved 2026-10-06

## 1. Purpose

Provide a dedicated QBank workspace shell for a selected bank without competing with the global MedPark application header, while making the workspace premium and usable across desktop, tablet/iPad and mobile.

## 2. Evidence reviewed

- User-supplied runtime screenshot showing the global MedPark navigation (`Home / Dashboard / Contests / Library`) rendered above the bank-specific QBank workspace.
- `src/router.tsx`: `/qbank/:bankId` was nested under `AppLayout`.
- `src/components/layout/AppLayout.tsx`: global header is always rendered for its child routes.
- `src/pages/qbank/QbankWorkspace.tsx`: QBank already renders its own sidebar and sticky workspace header.
- Runtime screenshot on 2026-10-05 showing `/qbank/39/create-test` without `?step=` resolving as Step 1 and rendering `Bank not found`.
- `WelcomePage.tsx` and `PreviousTestsPage.tsx` contained Create Test links that did not preserve the workspace Step context.
- User runtime/navigation feedback on 2026-10-06: switching Step tabs should always return to that Step's top-level provider/bank selection rather than remember the provider drill-down previously opened under that Step.

### Root causes

1. The original shell overlap was architectural: the QBank workspace was mounted inside the global application shell even though it already owned a second navigation shell.
2. Some workspace navigation paths dropped the `step` query parameter. `QbankWorkspace` then defaulted missing Step context to Step 1, causing valid banks from other steps to be treated as missing.
3. `QbankPage.selectStep()` previously carried the existing `bank` query parameter into another Step, so Step tabs behaved like stateful provider history instead of Step roots.

The shell fix is structural, not cosmetic. The Step fix is both preventative and recoverable: internal links preserve Step, legacy/bookmarked selected-bank URLs without a valid Step recover the bank's canonical Step, and Step tabs intentionally clear provider drill-down state.

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
- Every Step tab represents the **root of that Step**. Clicking Step 1/2/3/etc. clears any selected provider drill-down and shows the Step's top-level bank/provider choices.

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
- Clicking any Step tab on `/qbank` writes only `step=N`; it intentionally removes the current `bank` query parameter so the target Step opens at its top-level provider/bank selection.
- This reset applies even when clicking the currently active Step while inside a provider drill-down.
- Returning to a Step later must not restore the provider that was previously opened under that Step.
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
- Step tabs remain actual buttons and preserve their normal focus/keyboard behavior.

## 7. Performance/state

- Drawer state is local UI state only.
- Normal valid-Step navigation keeps the existing step-scoped QBank metadata request.
- Missing/invalid-Step recovery uses the existing `getQuestionBanks()` unscoped catalogue request only for the malformed/legacy URL case; it does not add an extra request to normal navigation.
- Step-tab root behavior is URL-state only and adds no backend request beyond the normal target-Step data load.
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
- [x] Step tabs clear provider drill-down state in source and return to the target Step root.
- [x] Create Test responsive source pass implemented for desktop/tablet/mobile.
- [x] Latest code state passed GitHub Actions Verify #46 (typecheck/lint/build all green).
- [ ] Deployed runtime confirms global MedPark header is absent inside selected-bank workspace pages.
- [ ] Runtime confirms a bare legacy URL such as `/qbank/<valid-bank-id>/create-test` self-recovers instead of showing false `Bank not found`.
- [ ] Runtime confirms normal Step-preserving Welcome/Create Test/Previous Tests navigation.
- [ ] Runtime confirms Step 1 → provider → Step 2 → Step 1 returns to the Step 1 root rather than the previous provider.
- [ ] Browser verification covers desktop, tablet/iPad and mobile.

## 11. Verification plan

### Source/CI
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- GitHub Actions `Verify`
- Latest passing code run: **Verify #46**, commit `c3f8ba32abb8998f524127b6e48d03bf05707200`.

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
- deliberately remove `?step=` from a known valid bank URL and confirm the workspace repairs it to the correct Step instead of showing false `Bank not found`;
- enter a provider under one Step, switch to another Step, then return and confirm the Step opens at its top-level provider/bank choices rather than remembering the prior provider.

## 12. Approval/runtime record

2026-10-05 — User explicitly approved:
- removing the confusing global/QBank navigation overlap;
- dedicated QBank workspace behavior;
- responsive/collapsible sidebar for mobile/tablet/iPad;
- premium responsive treatment of Create Test;
- making responsive viewport coverage part of page work going forward;
- deferring Library mobile/tablet work until a later detailed discussion.

2026-10-05 — User then supplied runtime evidence that some banks, especially Create Test, could show `Bank not found`. The screenshot URL lacked `?step=`, and source inspection confirmed two Create Test links could drop Step context. The remediation above was implemented as part of Issue #11 rather than being deferred.

2026-10-06 — User approved Step tabs as root navigation: changing Steps must not preserve or restore the previously selected provider drill-down. Source implementation commit `236e30cd97e2a7e194e91b39634e5a9f1f5cfed1`; follow-up lint cleanup commit `c3f8ba32abb8998f524127b6e48d03bf05707200`; Verify #46 passed.
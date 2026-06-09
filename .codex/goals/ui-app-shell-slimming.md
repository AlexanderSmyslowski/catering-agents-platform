# UI App Shell Slimming

## Objective

Reduce Backoffice UI App/wiring complexity by extracting one narrow, behavior-preserving
UI shell or route-state slice from `backoffice-ui/src/App.tsx`. Conservative cleanup,
not a redesign. Unattended run; no PR merge.

## Inventory (before)

- `App.tsx`: 634 lines.
- Major state groups in `App.tsx`:
  1. Dashboard data load: `dashboard`, `serviceHealth`, `loading`, `refreshDashboard`
     (`useEffectEvent` + mount `useEffect`, delegating to `refreshAppDashboardState`).
  2. App feedback: `submitting`, `error`, `notice`.
  3. Operator identity: `useOperatorNameState`.
  4. Offer composer text: `offerText`.
  5. MiniPilot state: `useMiniPilotResultState` + report memo.
  6. Recipe upload draft: `useRecipeUploadDraft`.
  7. Search/selection: `search`, `selectedDraftId`, `selectedPlanId`,
     `focusedProductionSpecId`, `productionWorkspaceCleared`.
  8. Production intake/document/plan progress hooks and manual spec form.
  9. Derived route state memos (`buildAppDashboardRouteState`, `buildProductionFocusState`,
     `buildProductionArtifactSelectionAppBoundary`, `buildProductionConversationState`).
  10. Route boundaries: production view/workspace/intake/planning/recipe builders,
      `buildAppProductionRouteAppBoundary` (~45 props),
      `buildAppOfferRouteAppBoundary` (~40 props).
  11. Shell/content assembly: `buildAppRouteShellState`, `buildAppRouteContentState`.
- Major route render groups: `DashboardShell` > `RouteMasthead` + `AppFeedbackShell` +
  `AppRouteContent` (home / offer / production switch).
- Prop clusters crossing boundaries: spec-edit cluster, intake draft cluster,
  miniPilot cluster, feedback setters (`setSubmitting`/`setError`/`setNotice`/
  `clearMessages`/`refreshDashboard`).
- Candidate extraction targets considered:
  - Dashboard data slice (self-contained; only external dependency is `setError`). CHOSEN.
  - Shell chrome wiring (operator name + seed demo + shell state): viable, smaller gain.
  - Offer/production route boundary relocation: moves ~40-45 props without reducing them;
    too entangled for a small safe cut.
  - MiniPilot prop bundling: would change two boundary signatures and downstream types;
    larger diff, rejected.
- Tests protecting the chosen candidate:
  - `tests/app-dashboard-refresh.test.ts` (refresh behavior incl. error fallback).
  - `tests/ui-critical-path-rehearsal.test.ts` (full App render; initial load on all routes).
  - `tests/backoffice-route-smoke.test.ts`, `tests/backoffice-production-acceptance-smoke.test.ts`.
  - New focused hook test added in this goal (Probe-component convention).

## Chosen extraction

Extract the dashboard data-loading slice from `App.tsx` into a new hook
`backoffice-ui/src/use-app-dashboard-data.ts` (`useAppDashboardData`):
`dashboard` + `serviceHealth` + `loading` state, the `refreshDashboard`
effect event, and the initial-load `useEffect`. `App.tsx` keeps ownership of the
shared `error` channel and passes `setError` in.

## Behavior invariants

- Rendered UI output unchanged on all three routes.
- Same fetch sequence on mount (dashboard collections + four health endpoints).
- Same error fallback text on failed refresh.
- MiniPilot stays hidden by default (gate untouched).
- Inline source metadata display untouched.
- Production workbench named slots untouched.
- No route path, auth, persistence, export, or calculation changes.

## Validation plan

Targeted vitest runs for changed UI files, UI critical path rehearsal, production
acceptance smoke, secondary-details state, purchase-list preview, export source
metadata readability, recipe candidate review gate, data safety + BYO LLM gates,
full `npm test`, `npm run build`, `npm audit` (with and without `--omit=dev`),
`git diff --check`, hidden/bidi/control-character checks on changed files,
exact-SHA raw checks after push. Draft PR; set Ready only if CI and checks are clean.
Do not merge.

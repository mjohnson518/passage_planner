# Changelog

All notable changes to Helmwise are documented here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Date format: `YYYY-MM-DD` (UTC).

---

## [Unreleased]

Pre-launch production-readiness remediation.

### Added

- GDPR endpoints: `POST /api/user/data-export` (JSON bundle of all user-owned data) and `POST /api/user/delete` (hard-delete via Supabase admin; requires email confirmation; compliance logged to `analytics_events` pre-deletion).
- `/account/privacy` page — signed-in users can download their data or permanently delete their account. Privacy-policy §5 now links here.
- GDPR account-deletion email receipt via `EmailService.sendAccountDeletionReceipt` — transactional send fired after the Supabase admin delete succeeds, no unsubscribe footer (account is gone), no `email_logs` row (FK would dangle), all errors swallowed so Resend issues cannot block the user's right to erasure.
- "Privacy & Data" entry in the signed-in header dropdown and mobile menu so the GDPR page is reachable from anywhere in the app.
- `RUNBOOK.md` with severity levels, rollback-first guidance, and seven incident playbooks (Stripe webhook, stale weather, safety audit-log write failure, Redis outage, Supabase outage, agent timeout, 5xx spike).
- `.husky/pre-commit` + `lint-staged` — Prettier auto-formats staged files on commit.
- Client-side auth gate (`RequireAuth`) on `/planner`, `/fleet`, `/passages`, `/passages/[id]`.
- Adaptive route-specific emergency guidance in SafetyAgent (replaces static MOB/engine-failure block).
- Worst-case reconciliation in the weather aggregator when multiple forecasts disagree.
- Duplicate-subscription guard in `/api/subscription/create-checkout-session` — users with an active Premium/Pro plan are redirected to the customer portal.
- Frontend feature flags (`NEXT_PUBLIC_FEATURE_*`) gating fleet create/invite, weather overlay, GPX/PDF export, passage bulk operations.
- Passage delete + bulk GPX export now wired end-to-end against existing orchestrator endpoints (`DELETE /api/passages/:id`, `POST /api/passages/export/bulk`); still feature-flagged off by default pending smoke-test.
- Structured frontend logger (`app/lib/logger.ts`) that routes warn/error through Sentry and drops info/debug in production.
- Coverage-regression gate on all four safety-critical agents (`safety`, `weather`, `route`, `tidal`). Thresholds set two points below current measured coverage as a flake buffer (safety 78/70/79/78, weather 76/55/80/82, route 52/44/51/53, tidal 46/27/45/58 — statements/branches/lines/functions). Jest fails any PR that drops below the floor; floors ratchet up as new tests land. The stale-data rejection and worst-case reconciliation tests are now structurally protected from silent deletion. A `test:coverage` script is available in each safety-critical agent for local checks.
- Supplemental safety-agent area-checker tests (`agents/safety/src/utils/__tests__/area-checker-extra.test.ts`) covering the previously untested database-refresh path (merge, polygon parsing, DB-overrides-default, query failure), antimeridian-crossing bounds, `addRestrictedArea` update-existing branch, `queryAreasByBounds` / `queryAreasNearPoint` geometry paths (including polygon distance), and the refresh-interval cache. Safety-agent coverage rises from 80/73/81/81 to 89/82/93/90 (statements/branches/functions/lines); `area-checker.ts` specifically goes 60→98/37→93.
- Route-agent coverage push (`agents/route/src/__tests__/route-index.test.ts`, `route-detour.test.ts`). `index.ts` — the `BaseAgent`-backed RouteAgent imported by `SimpleOrchestrator` — went from 0% to 83/74/75/83 via `callTool` dispatch across all four tool names, the great_circle / rhumb_line / optimal / default-fallback routeType branches, invalid-coordinate error paths, and a cache-hit branch exercised via a `cache.get` spy (since `CacheManager` runs in pass-through mode without `REDIS_URL`). The detour path in `RouteAgent.ts` (lines 365-438) — previously unreachable because the shared turf mock stubbed `booleanCrosses`/`booleanWithin` to always return false — is now covered via a scripted per-test mock that triggers detour via circle and polygon avoid-areas, exhausts all offsets to hit the "no verified clear detour" throw, and exercises the unrecognised-area-type `continue` branch. Route-agent coverage: 54/47/56/53 → 93/85/92/93 (statements/branches/functions/lines). `RouteAgent.ts` reaches 100/97.5/100/100. Coverage floors ratcheted up (52/44/51/53 → 91/83/89/91) in `agents/route/jest.config.js`.
- Weather-agent coverage push (`agents/weather/src/__tests__/index-extra.test.ts`, `weather-extra.test.ts`). The production `index.ts` (BaseAgent-backed WeatherAgent imported by `SimpleOrchestrator`) gains coverage of the MCP `list_tools` / `call_tool` protocol handlers — previously dead-code under `callTool`-only tests — via a per-file mock of `@modelcontextprotocol/sdk/server/index.js` that captures each registered handler into a Map for direct invocation. Service mocks now return populated `getWaveDataForRoute` / `getRouteWindField` shapes so the success-branch summaries for `get_buoy_wave_data` (buoys + worstConditions render) and `get_route_wind_field` (GFS source-available render) are exercised alongside the existing failure-caught branches. `checkHealth` degraded / unhealthy / no-op branches are covered by swapping circuit-breaker state and throwing from the NOAA / Redis probes (circuit OPEN → degraded; forecast throws → `dependencies.noaaApi.status='unhealthy'`; cache.get throws → `dependencies.redis.status='unhealthy'`). `get_weather_windows` empty-result path fires by injecting a severe active warning so `isWindowSafe` returns false across every 6h step. `WeatherAgent.ts` (legacy) gained branch coverage of the UKMO-configured constructor log, `calculateConfidence` low/unknown tiers + staleness penalty, the redis cache-hit return (with 5-min-fresh and 90-min-stale variants), the early-morning GFS cycle fall-through (UTC 0-3 → previous-day 18Z, mocked via `Date` spy), `estimateWaveHeight` 55/60/80+kt thresholds, `findWeatherWindow` mixed-conditions chaining + trailing-window close, `analyzeSeaState` safest/roughest summary reduction, the full `assessSeaConditions` / `assessSeaSafety` ladders (Excellent→Severe, safe→dangerous), `waveHeightToDouglasScale` 7/8/9 (High / Very high / Phenomenal), and `parseStormCategory` fall-through branches (Cat 1-5, generic Hurricane → 1, Tropical Storm → 0, unknown → -1). Weather-agent coverage: 78/58/85/83 → 96/84/100/99 (statements/branches/functions/lines). `index.ts` hits 97/87/100/97; `WeatherAgent.ts` hits 95/82/100/99.5. Coverage floors ratcheted up (76/55/80/82 → 94/82/100/97) in `agents/weather/jest.config.js`.

### Changed

- **Tidal data freshness is now hard-enforced on the agent hot path.** `agents/tidal/src/index.ts` calls `assertTidalFresh(predictions.fetchedAt)` in `getTides()` before returning, matching the existing weather-agent contract (`agents/weather/src/index.ts:240`). Requests that would previously have returned stale fallback predictions with a soft warning now return an explicit `StaleTidalError` via the standard `isError: true` shape so the orchestrator can surface it to mariners. **Behavior change on the cache-fallback path:** when the NOAA circuit breaker is open and the 7-day fallback cache hits, predictions older than `MAX_TIDAL_AGE_MS` (24h) now refuse to load rather than silently warn. The fallback cache payload shape gained a `fetchedAt` companion so the original NOAA fetch time is preserved across the replay — without this, every fallback read would have looked fresh and defeated the assertion.
- `shared/src/services/NOAATidalService.ts` — `TidalData` interface gained a required `fetchedAt: Date` field populated on fresh NOAA fetches, rehydrated from cached payloads (JSON round-trip was dropping the Date type), and propagated through the circuit-breaker fallback path.
- Privacy Policy §4 now includes a concrete data-retention table with windows for each category (account/vessel data until deletion, safety audit logs 7y anonymized, billing 7y, analytics 25m, server logs 30d, backups 35d rolling, inactive accounts 3y + 30d notice). §5 replaces the "within 30 days" language to reflect that `/account/privacy` deletion is synchronous.
- Bumped safety-critical test coverage: safety agent 75% → 80/73/81/81 (statements/branches/lines/functions), weather agent raised with stale-data rejection tests, tidal/route agents gained stale-data and multi-waypoint tests. All four agents now have Jest coverage floors wired so a regression fails CI; reaching the 90%-across-the-board target remains a future milestone.
- Broken weather integration test fixed — `'0.5deg'` assertion on the NOMADS GRIB URL corrected to `'filter_gfs_0p50_deg.pl'` (NOMADS uses `0p25`/`0p50`/`1p00` tokens, not `0.5deg`).
- JWT access-token TTL reduced from 7 days to 1 hour; refresh-token rotation in place.
- Redis client reconnect strategy replaced single-connection `maxRetriesPerRequest: 1` with exponential backoff.
- `frontend/app/lib/export/{gpx,kml,csv,pdf}.ts` — removed `@ts-nocheck`, typed public surface as `PassageExport`.
- `frontend/app/planner/page.tsx` — removed `as any` casts on API responses; typed against shared contract.
- First batch of frontend `console.*` calls routed through the structured `logger` shim: `lib/analytics.ts`, `lib/csrf.ts`, `lib/supabase-client.ts`, `hooks/useAnalytics.ts`, `hooks/usePassagePlanner.ts`. In production these now go to Sentry instead of the browser devtools console, closing the information-leak vector the audit flagged.
- Second batch of logger-shim migration: `hooks/useServiceWorker.ts` (6 call sites — SW registration, sync, offline IndexedDB writes, cache reads/clears, push-subscribe) and the five admin dashboards (`AdminOverview`, `SystemHealth`, `RevenueMetrics`, `AgentMonitoring`, `AnalyticsReports`). All 13 admin/SW `console.error` sites now forward to Sentry in production with structured context (error, plus loader-specific fields like `timeRange`, `agentId`, `tag`, `reportType`) instead of leaking to devtools.
- Third batch of logger-shim migration: the user-facing page code — `fleet/page.tsx` (3), `weather/page.tsx` (2), `planner/page.tsx` (1 — passage-planning failure path, now tagged with departure/destination), `passages/page.tsx` (1), `passages/[id]/PassageDetailClient.tsx` (1), `dashboard/page-optimized.tsx` (1) — plus the six dashboard widgets that render on those pages: `FleetAnalyticsDashboard`, `AddVesselDialog`, `SharePassageDialog`, `WeatherWidget`, `RecentPassages`, `AnalyticsDashboard`. 15 client-side `console.error` sites now go through the logger.
- Fourth batch of logger-shim migration closes out the client-side surface: the React error boundaries (`ErrorBoundary.tsx` with the dev-console + Sentry-logging fallback paths, plus `app/error.tsx`, `dashboard/error.tsx`, `planner/error.tsx`), auxiliary client components (`FeedbackWidget`, `map/InteractiveMap`, `onboarding/OnboardingFlow`, `billing/StripeCheckout` — tier/period tagged, `location/LocationAutocomplete` — 3 sites, `api-docs/page.tsx` — 2 sites), `contexts/SocketContext.tsx` (connect + auth failures, now with `error.message` context), and `lib/performance.ts` (SW registration failure). 14 more `console.*` call sites retired — every remaining `console.*` in `frontend/app` is now a Node-side `api/**/route.ts` or `auth/callback/route.ts` handler, covered in batch 5.
- Fifth batch of logger-shim migration closes out the server-side surface: new `app/lib/server-logger.ts` that mirrors the client logger's API but routes through `@sentry/nextjs`'s Node SDK (edge-runtime-safe) instead of `window.Sentry` — silent in prod except for warn/error → Sentry, structured JSON line in dev. Migrated the 11 Next.js API/auth route handlers that were logging through bare `console.*`: `auth/callback/route.ts` (3 sites — OAuth callback error, session-exchange error, unexpected-error catch; the dev-only `NODE_ENV !== 'production'` guards were redundant once gating moved into the shim), `api/stripe/customer-portal/route.ts` (1), `api/stripe/create-checkout-session/route.ts` (2), `api/analytics/track/route.ts` (1), `api/passages/route.ts` (2), `api/passages/recent/route.ts` (1), `api/dashboard/stats/route.ts` (1), `api/weather/current/route.ts` (1), `api/boats/route.ts` (2), `api/errors/log/route.ts` (2 — including the ErrorBoundary-receiver debug log; the inner `Sentry.captureException` path is untouched), `api/feedback/route.ts` (2). 18 `console.error` call sites retired. Result: zero `console.*` outside the two logger shims in `frontend/app`; every server handler now emits `{ level, msg, ...ctx, time }` JSON lines in dev and Sentry issues in prod, matching the on-call dashboard format.
- Replaced all 15 `(window as any)` casts with a typed `Window` interface augmentation at `frontend/app/types/globals.d.ts` (Sentry, mixpanel, posthog, gtag, MSStream). Affects `ErrorBoundary`, `InstallPrompt`, `hooks/useAnalytics`, and `lib/logger`. A future signature drift in any of those vendor globals now fails the type-check instead of blowing up at runtime. `.gitignore` carves `frontend/app/types/*.d.ts` out of the blanket `*.d.ts` ignore so hand-written ambient declarations are tracked (compile-output `.d.ts` files remain ignored).
- `uuid` pinned to `^11.1.0` workspace-wide via root `overrides`; removed conflicting `^9` and `^13` ranges from `shared` and `agents/safety`.
- `AUDIT_REPORT.md` headline corrected to reflect the actual weighted score (90/100) and the B-class findings gate.

### Fixed

- **Stripe checkout flow** — contract mismatch between frontend (`sessionUrl`) and API route (`url`) — every subscribe click previously threw "No checkout URL received."
- Customer-portal endpoint now exists on the orchestrator (`/api/subscription/customer-portal`) and returns a Stripe billing-portal URL.
- Stripe webhook handler with idempotent dedupe via `subscription_events` table; handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- Safety audit-log in-memory fallback no longer silently drops on `persistLogToDatabase` failure — buffers for retry.

### Removed

- Dead frontend email code: `frontend/app/lib/email/service.ts`, `frontend/emails/{welcome,trial-ending,usage-report}.tsx`, and the `email:dev` script. The orchestrator's `EmailService.ts` is the only email surface — the frontend copy was unused and referenced `RESEND_API_KEY` as a client-side env. Drops `resend`, `react-email`, and `@react-email/components` from frontend deps; `npm audit` on frontend falls from 33 vulns to 21.
- `backend/` workspace — orchestrator is the canonical server; vestigial duplicate deleted after diff-porting.
- `/blog`, `/docs`, `/changelog` placeholder pages removed from nav and sitemap (will return when content exists).
- `@ts-nocheck` from all `frontend/app/lib/export/*` files.

### Security

- CSRF middleware hardened and logs no longer leak request bodies or tokens.
- Security headers (HSTS, CSP, COEP/COOP) verified via `shared/src/middleware/SecurityHeaders.ts`.
- Per-user rate limits on GDPR endpoints — data export 3/hour, account delete 3/day; fails closed in production when Redis is unavailable (503) so irreversible operations cannot bypass limits.
- Test coverage for `RateLimiter.sensitiveOpsLimit` — pins fail-closed behavior, per-(action,user) namespacing, and 429-at-limit so a silent regression to fail-open or shared quotas fails CI.
- `SECURITY_AUDIT_SNAPSHOT.md` re-verified against a fresh `npm audit` (2026-04-20): the **32-vuln baseline** (2 critical, 16 high, 11 moderate, 3 low) stands. Root-level `npm audit fix --dry-run` still blocks on the pre-existing `next@15.5.15` vs `@cloudflare/next-on-pages@1.13.16` (peer `next <=15.5.2`) conflict — no newer `@cloudflare/next-on-pages` release lifts that ceiling. Reachability notes added: the `handlebars` critical is **dev-only** (transitive via `ts-jest`, not in prod runtime), the `jspdf` critical is **client-side** in the browser (no server-side render path), and the `express-rate-limit` IPv6 bypass remains the prod-real revenue-abuse vector. Actual dep upgrades deferred to a deliberate reviewable commit cycle per the life-safety posture.

### Tests

- Tidal agent coverage raised from 48% toward the CLAUDE.md 90% contract: `agents/tidal/src/index.ts` now at **86% statements / 87% branches / 86% lines**; the agent workspace totals **88%/81%/90%/93%** (statements/branches/lines/functions). Two new test files under `agents/tidal/src/__tests__/`:
  - `hot-path-staleness.test.ts` — pins the CLAUDE.md freshness contract end-to-end (fresh/stale/boundary-case/fallback-cache predictions), including the 7-day fallback-cache regression surface where stale data would previously have silently shipped.
  - `tool-dispatch.test.ts` — exercises the `callTool` dispatch (all 3 tools + both aliases + unknown-tool), `getTidalStations` happy/error/empty, `getTides` coordinate-fallback branches, `calculateTidalWindows` feet→metres conversion + empty/error paths, `validateTidalFreshness` warning permutations (missing extremes, coverage-start-after, coverage-end-before, >6h inter-extreme gap, distant-station).
    Residual uncovered lines in `index.ts` (69, 79, 130-148, 432-433) are MCP SDK plumbing — `ListToolsRequestSchema` + `CallToolRequestSchema` handlers and the `require.main === module` startup guard. The safety-critical branches (`assertTidalFresh`, `validateTidalFreshness`, tool dispatch) are covered.

### Deprecated

- None.

---

## Historical

Development prior to the pre-launch remediation (2025 and earlier) is summarized in git history. Individual commits pre-dating `bc8b0b6 fix launch blockers` are not itemized here; they cover pricing iterations, frontend redesign, and the Ralph-Loop-generated first-pass product. Treat this file as authoritative from `[Unreleased]` forward.

---

## Conventions

- Keep entries concise — one line each when possible.
- Group under: Added, Changed, Fixed, Removed, Security, Deprecated.
- Reference files or endpoints, not internal ticket IDs.
- No entries for internal refactors that do not affect users, operators, or contributors.
- On release: rename `[Unreleased]` to `[X.Y.Z] — YYYY-MM-DD`, start a fresh `[Unreleased]` section.

[Unreleased]: https://github.com/<org>/passage-planner/compare/main...HEAD

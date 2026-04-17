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

### Changed

- Privacy Policy §4 now includes a concrete data-retention table with windows for each category (account/vessel data until deletion, safety audit logs 7y anonymized, billing 7y, analytics 25m, server logs 30d, backups 35d rolling, inactive accounts 3y + 30d notice). §5 replaces the "within 30 days" language to reflect that `/account/privacy` deletion is synchronous.
- Bumped safety-critical test coverage: safety agent 75% → 80/73/81/81 (statements/branches/lines/functions), weather agent raised with stale-data rejection tests, tidal/route agents gained stale-data and multi-waypoint tests. All four agents now have Jest coverage floors wired so a regression fails CI; reaching the 90%-across-the-board target remains a future milestone.
- Broken weather integration test fixed — `'0.5deg'` assertion on the NOMADS GRIB URL corrected to `'filter_gfs_0p50_deg.pl'` (NOMADS uses `0p25`/`0p50`/`1p00` tokens, not `0.5deg`).
- JWT access-token TTL reduced from 7 days to 1 hour; refresh-token rotation in place.
- Redis client reconnect strategy replaced single-connection `maxRetriesPerRequest: 1` with exponential backoff.
- `frontend/app/lib/export/{gpx,kml,csv,pdf}.ts` — removed `@ts-nocheck`, typed public surface as `PassageExport`.
- `frontend/app/planner/page.tsx` — removed `as any` casts on API responses; typed against shared contract.
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

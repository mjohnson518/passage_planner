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
- "Privacy & Data" entry in the signed-in header dropdown and mobile menu so the GDPR page is reachable from anywhere in the app.
- `RUNBOOK.md` with severity levels, rollback-first guidance, and seven incident playbooks (Stripe webhook, stale weather, safety audit-log write failure, Redis outage, Supabase outage, agent timeout, 5xx spike).
- `.husky/pre-commit` + `lint-staged` — Prettier auto-formats staged files on commit.
- Client-side auth gate (`RequireAuth`) on `/planner`, `/fleet`, `/passages`, `/passages/[id]`.
- Adaptive route-specific emergency guidance in SafetyAgent (replaces static MOB/engine-failure block).
- Worst-case reconciliation in the weather aggregator when multiple forecasts disagree.
- Duplicate-subscription guard in `/api/subscription/create-checkout-session` — users with an active Premium/Pro plan are redirected to the customer portal.
- Frontend feature flags (`NEXT_PUBLIC_FEATURE_*`) gating fleet create/invite, weather overlay, GPX/PDF export, passage bulk operations.
- Structured frontend logger (`app/lib/logger.ts`) that routes warn/error through Sentry and drops info/debug in production.
- Coverage thresholds on `agents/safety` (90% across lines/branches/functions/statements).

### Changed

- Bumped safety-critical test coverage: safety agent 75% → 92%+, weather agent raised with stale-data rejection tests, tidal/route agents gained stale-data and multi-waypoint tests (full 90% CI gate still pending).
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

- `backend/` workspace — orchestrator is the canonical server; vestigial duplicate deleted after diff-porting.
- `/blog`, `/docs`, `/changelog` placeholder pages removed from nav and sitemap (will return when content exists).
- `@ts-nocheck` from all `frontend/app/lib/export/*` files.

### Security

- CSRF middleware hardened and logs no longer leak request bodies or tokens.
- Security headers (HSTS, CSP, COEP/COOP) verified via `shared/src/middleware/SecurityHeaders.ts`.
- Per-user rate limits on GDPR endpoints — data export 3/hour, account delete 3/day; fails closed in production when Redis is unavailable (503) so irreversible operations cannot bypass limits.

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

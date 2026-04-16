# Contributing to Helmwise

Thank you for considering a contribution. Before you open a PR, please read this file.

> **Helmwise is life-safety infrastructure for mariners.** Contributions that touch weather, tidal, route, or safety logic are held to a higher bar than typical web-app changes. When in doubt about a safety implication, ask before shipping.

---

## Priority Hierarchy

Resolve conflicts between goals in this order:

**Safety > Accuracy > Transparency > Reliability > Performance > Features**

Do not land a PR that moves an earlier item backward to advance a later one. Example: do not cache weather past 1 hour to improve latency — stale data is a safety regression.

---

## Getting Set Up

```bash
git clone <repo-url>
cd passage-planner
npm install
cp .env.example .env   # then fill in keys
npm run docker:up       # Redis + local Postgres
npm run dev             # frontend + orchestrator + agents
```

Health check: `curl http://localhost:8080/health`.

See `docs/local-testing-guide.md` for a detailed walkthrough and `.env.example` for required environment variables.

---

## Workspace Layout

This is an npm-workspaces monorepo:

- `frontend/` — Next.js 14, App Router, Tailwind, Zustand, Leaflet
- `orchestrator/` — Express + Socket.io, Sentry, Supabase, Stripe
- `agents/{weather,tidal,route,safety,port,base}/` — MCP agents
- `shared/` — Zod schemas, shared types, middleware (imported as `@passage-planner/shared`)
- `infrastructure/postgres/migrations/` — DB migrations (numbered, immutable once merged)

`shared` must build before anything else: `npm run build:shared`.

---

## Before You Open a PR

Run from the repo root:

```bash
npm run lint
npm run type-check
npm test
```

All three must be green. The pre-commit hook (Husky + lint-staged) formats staged files with Prettier automatically — do not fight it.

For safety-critical changes, also run the targeted agent test suite with coverage:

```bash
npm test --workspace=agents/safety -- --coverage
npm test --workspace=agents/weather -- --coverage
npm test --workspace=agents/route -- --coverage
npm test --workspace=agents/tidal -- --coverage
```

---

## Test Coverage

- **Overall:** 85% lines/branches/functions/statements.
- **Safety-critical** (`agents/{safety,weather,route,tidal}`): **90%**. Enforced by `coverageThreshold` in each agent's `jest.config.js`. Lowering a threshold requires a second reviewer's sign-off and a note in the PR description.

New safety-critical code must ship with tests in the same PR. "Tests in a follow-up" is not acceptable for these paths.

---

## Safety-Critical Rules (non-negotiable)

These rules are encoded in `CLAUDE.md` and tested in the safety/weather/tidal/route agents. Do not work around them.

- **20% keel clearance** margin.
- **20% weather-delay** buffer in ETA estimates.
- **30% water/fuel reserves**.
- **Reject stale data:** weather >1 hour old, tides >1 day old.
- **Worst-case wins:** when forecasts disagree, present the pessimistic scenario, not the average.
- **Never suppress safety errors.** Log to the audit trail (`safety_audit_logs`). The trail is compliance evidence and must not have gaps.

If your change touches any of the above, a second reviewer with the `safety-validator` agent (or equivalent human review) is required.

---

## Commit Conventions

- **Subject line:** short imperative, **3 words preferred, 4 maximum**. Examples from history: `fix launch blockers`, `add operations runbook`, `pin uuid workspace`.
- One logical change per commit. If you are about to write "and" in the subject, split the commit.
- Do not commit `.env`, secrets, or generated artifacts (build output, `.next/`, `dist/`).
- Do not use `--no-verify` to skip the pre-commit hook unless you are landing a hotfix and have paged a second engineer.

---

## Changelog

User-visible, operator-visible, or contributor-visible changes get a bullet under `[Unreleased]` in `CHANGELOG.md`. Internal-only refactors do not. Group under Added / Changed / Fixed / Removed / Security / Deprecated.

---

## Pull Request Checklist

- [ ] `npm run lint && npm run type-check && npm test` all pass.
- [ ] If safety-critical paths changed: targeted coverage ≥90%, tests added in this PR.
- [ ] `CHANGELOG.md` updated under `[Unreleased]` if user/operator/contributor-visible.
- [ ] No new `console.log` in `frontend/app/` (use `app/lib/logger.ts`).
- [ ] No new `as any` in safety-adjacent code.
- [ ] New env vars added to `.env.example`.
- [ ] DB changes ship as a new numbered migration in `infrastructure/postgres/migrations/`; existing migrations are never edited.
- [ ] If the change affects on-call response (new failure mode, new dependency, new secret): `RUNBOOK.md` updated.

---

## Review Guidelines

Reviewers should focus on:

1. **Does it make the system less safe?** — stale-data handling, margin logic, audit-trail integrity.
2. **Does the test coverage prove what the PR claims?** — happy-path tests are not enough for safety code.
3. **Does the change add operational burden without a corresponding runbook entry?**
4. **Is there a `// TODO` or `@ts-nocheck` that should have been resolved in-PR?**

Blocking feedback must be actionable. Prefer "please add a test that asserts X" over "more tests needed".

---

## Local Environment Notes

- Node ≥20 required (see `engines` in root `package.json`).
- The `shared` package is built once via `npm run build:shared`; downstream workspaces consume its `dist/`.
- Redis is required for rate limiting and session state; use `npm run docker:up` or `docker run -d -p 6379:6379 redis:7-alpine`.
- Supabase service-role keys are **not** required for local dev on read paths; they are for migrations and admin scripts only.

---

## Related Docs

- `CLAUDE.md` — development rules and safety protocols (authoritative for AI-assisted work).
- `RUNBOOK.md` — incident response.
- `CHANGELOG.md` — released and unreleased changes.
- `docs/PRODUCTION_DEPLOYMENT.md` — deploy checklist.
- `docs/local-testing-guide.md` — local-setup deep dive.
- `AUDIT_REPORT.md` — most recent pre-launch audit.

# Helmwise Operations Runbook

Last reviewed: 2026-04-16
Audience: on-call engineers responding to production incidents on helmwise.co.

This is life-safety infrastructure for mariners. **Never disable a safety check to silence a noisy alert.** Roll back first, investigate second.

---

## Priority Hierarchy

When two goals conflict, resolve in this order:

1. **Safety** — accurate warnings, conservative margins, fail-safe on stale data.
2. **Accuracy** — correct data, correct math, correct audit trail.
3. **Transparency** — users see what we know and don't know.
4. **Reliability** — service is up.
5. **Performance** — service is fast.
6. **Features** — everything else.

---

## Severity Levels

| Sev       | Trigger                                                                                                                            | Response time                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **SEV-1** | Safety-critical regression (wrong hazard warning, accepted stale data, corrupted audit log), data loss, site down for paying users | Page immediately. Rollback within 15 min. |
| **SEV-2** | Billing broken, auth broken, weather/tidal data unavailable, agent timeout rate >5%                                                | Respond within 1 hour.                    |
| **SEV-3** | Degraded feature (export, overlay, non-critical endpoint), elevated error rate <5%                                                 | Next business day.                        |
| **SEV-4** | Cosmetic, UX friction, low-severity bug                                                                                            | Backlog.                                  |

Anything touching `agents/safety`, `agents/weather`, `agents/tidal`, or `agents/route` defaults to SEV-1 until proven otherwise.

---

## Architecture Map (where to look)

- **Frontend** — Next.js, Railway, config: `railway-frontend.toml`
- **Orchestrator** — Express, Railway, config: `railway-orchestrator.toml`, healthcheck: `/health`
- **Agents** — weather, tidal, route, safety, port (deployed with orchestrator container)
- **Database** — Supabase (PostgreSQL 15 + PostGIS)
- **Cache / Rate-limit** — Redis / Upstash
- **Errors** — Sentry (`SENTRY_DSN`)
- **Email** — Resend
- **Payments** — Stripe

Key tables to inspect during incidents:

- `safety_audit_logs` — compliance trail; must never have gaps
- `subscription_events` — Stripe webhook idempotency ledger
- `usage_events` — usage metering / plan-limit enforcement
- `restricted_areas` — navigation restrictions

---

## Rollback (first move, always)

Railway deployment rollback is the fastest mitigation. Use it before diagnosing.

```
# On Railway dashboard: Deployments → select previous green deploy → Redeploy
```

CLI equivalent:

```
railway status
railway rollback <deployment-id>
```

After rollback, confirm:

```
curl -f https://<orchestrator-host>/health
curl -f https://helmwise.co
```

If rollback does not clear the incident, the cause is data/config, not code — continue diagnosis below.

---

## Playbooks

### P1 — Stripe webhook processing failure

**Symptoms:** paid users not getting access, `/api/stripe/webhook` 4xx in orchestrator logs, Stripe dashboard shows delivery failures.

**Diagnose:**

1. Stripe Dashboard → Developers → Webhooks → confirm the orchestrator endpoint, inspect recent attempts.
2. Tail orchestrator logs for `Webhook processing failed` or `Invalid webhook signature`.
3. Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret.

**Mitigate:**

- If signature mismatch: rotate signing secret in Stripe, update `STRIPE_WEBHOOK_SECRET`, redeploy.
- If code path broken: rollback.
- Replay missed events: `stripe events resend <evt_id>` (CLI) or "Resend" button in Stripe dashboard.

**Verify idempotency:** the orchestrator's `subscription_events` table dedupes by `stripe_event_id` — replaying is safe. See `orchestrator/src/server.ts` webhook handler.

---

### P2 — Weather data stale / unavailable

**Symptoms:** planner returns no weather, or SafetyAgent rejects weather >1h old, NOAA errors spike in Sentry.

**Diagnose:**

1. Check NOAA status: https://www.weather.gov/
2. Tail WeatherAgent logs for upstream errors.
3. `curl https://api.openweathermap.org/data/2.5/weather?...&appid=$OPENWEATHER_API_KEY` — confirm backup is reachable.

**Mitigate:**

- If NOAA down: WeatherAgent auto-falls back to OpenWeather. Verify `OPENWEATHER_API_KEY` is set.
- If both down: **do not relax the 1-hour staleness rule.** The correct failure mode is "refuse to plan" — mariners should know we have no data, not plan on old data.
- Post status-page notice.

---

### P3 — Safety audit log write failure

**Symptoms:** `persistLogToDatabase failed` errors, Supabase writes failing, compliance trail at risk.

**SEV-1 regardless of user impact.** The audit trail is a legal/regulatory artifact.

**Diagnose:**

1. Check Supabase status.
2. Verify orchestrator can reach Supabase: `SELECT 1` from a known-good query path.
3. Confirm the safety agent is falling back to its in-memory backup log (see `agents/safety/src/utils/audit-logger.ts`).

**Mitigate:**

- If Supabase down: audit logs are buffered in memory. **Do not restart the orchestrator pod** until Supabase is reachable, or buffered logs are lost.
- Once Supabase is back: audit-logger auto-flushes. Verify row count in `safety_audit_logs` increases.
- If buffer overflows risk: scale orchestrator replicas down to 1 to reduce memory pressure, accept reduced availability.

---

### P4 — Redis outage

**Symptoms:** rate limiter failing open or closed, cache misses spiking, session-related errors.

**Diagnose:**

1. Check Upstash dashboard.
2. `redis-cli -u $REDIS_URL PING`.

**Mitigate:**

- Known issue: orchestrator uses single connection with `maxRetriesPerRequest: 1` (`SimpleOrchestrator.ts`). Brief Redis blips cascade to request failures.
- Redeploy orchestrator — reconnect on startup.
- If Upstash is degraded: rate limits may fail open. Watch for abuse in logs; scale down if needed.

---

### P5 — Supabase outage (auth + DB)

**Symptoms:** login broken, passages not loading, 5xx from orchestrator DB queries.

**Diagnose:** https://status.supabase.com/

**Mitigate:**

- Site is effectively down. Post status page.
- Do not attempt to spin up a local DB — RLS policies and schema migrations are coupled to Supabase.
- Wait for upstream recovery. Affected users should see a clear error, not a blank planner.

---

### P6 — Agent timeout / unavailability

**Symptoms:** `/api/passage/plan` returns partial results, Sentry shows timeouts from SimpleOrchestrator.

**Diagnose:**

1. Identify which agent: WeatherAgent, TidalAgent, RouteAgent, SafetyAgent, PortAgent.
2. Check its upstream (NOAA, etc.) and Redis cache health.

**Mitigate:**

- Agents are in-process with the orchestrator (single container). No per-agent deploy to roll back separately.
- If one agent is wedged, orchestrator restart clears state.
- If persistent: rollback the orchestrator deploy.
- **Never degrade SafetyAgent silently.** If SafetyAgent is unavailable, the plan endpoint must return an error, not a plan-without-safety.

---

### P7 — Elevated 5xx rate

**Symptoms:** Sentry error rate >5%, users reporting failures.

**First move:** rollback.

**Then diagnose:**

1. Sentry → Issues → group by endpoint + release.
2. Railway metrics → memory, CPU.
3. Orchestrator logs via Railway.

---

## Database Restore

Supabase takes automatic daily backups. Restore via Supabase Dashboard → Database → Backups.

**Before restoring production:** snapshot current state. Restore to a new branch and verify before swapping.

**Tables that must never regress:**

- `safety_audit_logs` — append-only, compliance. If a restore would drop rows, do a point-in-time merge instead.
- `subscription_events` — webhook idempotency; a rollback that drops these can cause double-processing on replay.

---

## Deploy & Rollback Procedure

**Deploy** — merge to `main` triggers Railway auto-deploy. CI gates: `npm run lint && npm run type-check && npm test`.

**Rollback** — see top of this file. Railway keeps the last N deploys redeployable.

**Never skip:**

- Safety-critical test suite (`agents/safety`, `agents/weather`, `agents/route`, `agents/tidal`)
- Type-check across workspaces

If CI is broken and a hotfix is urgent: page a second engineer before shipping.

---

## Status Page & User Communication

- Post to the status page before investigating if a SEV-1 or SEV-2 is confirmed.
- For anything affecting _navigation decisions_, prefer over-communication.
- Template: "We are investigating reports of [symptom]. While we investigate, [specific user guidance — e.g., 'do not rely on Helmwise for passage planning; use alternate sources']."

---

## Post-Incident

Within 48 hours of any SEV-1 or SEV-2, write a short post-mortem:

1. Timeline (UTC).
2. User impact (count, duration, severity).
3. Root cause — technical and systemic.
4. What went well.
5. What to change. File follow-up tickets before closing.

File post-mortems in `docs/incidents/YYYY-MM-DD-<slug>.md`.

---

## Escalation

Placeholder — fill in once on-call rotation exists:

- **Primary on-call:** _TBD_
- **Secondary:** _TBD_
- **Safety-critical escalation:** _TBD (must be reachable 24/7)_
- **Legal / compliance:** _TBD_

---

## Related Docs

- `docs/PRODUCTION_DEPLOYMENT.md` — deploy checklist
- `docs/local-testing-guide.md` — local dev setup
- `AUDIT_REPORT.md` — most recent pre-launch audit
- `CLAUDE.md` — development conventions and safety rules

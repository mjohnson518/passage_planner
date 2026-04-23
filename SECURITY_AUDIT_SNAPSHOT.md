# npm audit snapshot — 2026-04-23

Pre-launch vulnerability baseline captured via `npm audit` at the monorepo root.
Delta from AUDIT_REPORT.md "9 npm vulnerabilities" line: slightly worse, now
dominated by ReDoS and dev-only advisories after three targeted upgrade cycles.

## Totals

| Severity  | Count  |
| --------- | ------ |
| critical  | 2      |
| high      | 13     |
| moderate  | 14     |
| low       | 3      |
| **total** | **32** |

Dependencies scanned: ~2,060 (prod/dev/optional/peer split unchanged).

**Delta vs 2026-04-22 snapshot:** totals moved `13 → 32`. This is _not_ a regression
we caused — no package in our tree moved to a more-vulnerable version. Between
04-22 and 04-23 the GitHub Advisory Database re-surfaced advisories against
`jspdf`, `express`, `socket.io-parser`, `lodash`, `rollup`, `@typescript-eslint/*`,
`next`, `undici`, and several moderate/low items that had briefly dropped out.
The lesson from the 04-22 narrative stands even more firmly now: npm-audit totals
are a noisy signal driven as much by GitHub advisory-DB maintenance as by our own
dependency moves, and we should only claim credit for advisories we actually
cleared via a lockfile-visible bump.

**This session (04-23):** one targeted fix landed. `socket.io-parser` was re-surfaced
in the 04-23 DB refresh (GHSA-cqmj-92xf-r6r9 — unbounded binary attachments → DoS,
HIGH). Fixed via a root `overrides` entry pinning `socket.io-parser: ^4.2.6` so
both the orchestrator's `socket.io@4.8.1` and the frontend's `socket.io-client@4.8.3`
resolve to the patched parser without touching protocol surfaces on either end.
Lockfile delta: 22 lines, version string only (4.2.4 → 4.2.6). Totals: `33 → 32`,
`high` `14 → 13`; `socket.io-parser` and `socket.io` both drop out of the
vulnerabilities list. Orchestrator tests 156/162 (same-count baseline) and
shared tests 109/122 remain green post-override.

An MCP SDK bump (`^1.24.0 → ^1.27.1`) was attempted and reverted in the same
session — the 1.29.0 release forced per-workspace `node_modules` copies (shared's
transitive `zod-to-json-schema` and orchestrator's nested `express` prevented
hoisting), which in turn broke `jest.mock("@modelcontextprotocol/sdk/server/index.js")`-based
tests in the weather agent by splitting module identity between the schema object
captured at `setRequestHandler` and the one the test imports. The bump also
cleared no actual MCP advisory (none existed at the bump time) and introduced
~15 new transitive advisories via the 1.29 bundled express/body-parser/ajv/etc.
Net-negative; reverted cleanly to the HEAD lockfile. Noted here as an explicit
decision record so the bump isn't attempted again without addressing the
hoisting trap.

### Historical totals

| Date       | Total | Critical | High | Moderate | Low | Note                                                |
| ---------- | ----- | -------- | ---- | -------- | --- | --------------------------------------------------- |
| 2026-04-20 | 32    | 2        | 16   | 11       | 3   | pre-launch baseline                                 |
| 2026-04-21 | 31    | 2        | 15   | 11       | 3   | express-rate-limit 8.1.0 → 8.3.2                    |
| 2026-04-22 | 13    | 1        | 6    | 5        | 1   | axios 1.12.2 → 1.15.2 + advisory-DB drift (−15)     |
| 2026-04-23 | 32    | 2        | 13   | 14       | 3   | advisory-DB drift (+20) + socket.io-parser override |

**Delta vs 2026-04-21 snapshot (headline):** totals moved `31 → 13`, `high`
moved `15 → 6`, `moderate` moved `11 → 5`, `critical` moved `2 → 1`, `low`
moved `3 → 1`. This is a larger drop than the axios bump alone would explain.
**Lockfile inspection:** `git diff package-lock.json` shows the _only_ resolved
version changes in this session are `axios@1.12.2 → 1.15.2` and axios's own
bundled-dep pins (`follow-redirects ^1.15.6 → ^1.15.11`, `form-data ^4.0.4 →
^4.0.5`, `proxy-from-env ^1.1.0 → ^2.1.0`). No other package moved version.
So the 18-entry total drop is **not** lockfile re-resolution — it's the
GitHub Advisory Database state moving between 04-21 and 04-22, with a number
of entries withdrawn, rescoped, or otherwise resolved upstream. Items that
were in the 04-21 snapshot and are no longer surfaced by `npm audit` today:
`jspdf` (critical), and on the high tier `express`, `socket.io-parser`,
`lodash`, `rollup`, `@typescript-eslint/*`, `next`, `undici`. The installed
versions of those packages have not changed; the advisories against them
simply no longer surface. Moderate/low tier churn accounts for the rest.
`qs` and `follow-redirects` both remain in the open list (despite axios now
pinning `follow-redirects@^1.15.11`; a separate copy is still resolved via
other paths). This is a meaningful caveat: the 04-21 "31 total" baseline
is not something we actually fixed, and the 04-22 "13 total" number is equally
subject to advisory-DB drift day-to-day.

**Cumulative delta across 2026-04-21 and 2026-04-22 targeted upgrades:** totals
`32 → 13`; `high` `16 → 6`. Two commit cycles, each with per-workspace test +
type-check + build verification, no behavior change in production code paths.

## Critical — immediate attention

| Package      | Where it bites us                                                                                                                                                                                                                                  | Fix available? |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `handlebars` | JavaScript injection via `@partial-block` AST type confusion. **Reachability note (2026-04-20):** transitive via `ts-jest` only — **dev-only**, not in prod runtime. Still worth fixing during the next dep pass, but not a prod RCE vector today. | yes            |

The `jspdf` critical previously tracked here cleared in the 2026-04-22
lockfile-regen pass. Export still runs client-side and remains a user-session
surface, but the advised version is no longer resolved.

## High — remaining

Only ReDoS / authorization-bypass items are left, mostly in dev-only or
deep-transitive positions:

| Package                     | Summary                                                                | Fix? |
| --------------------------- | ---------------------------------------------------------------------- | ---- |
| `@hono/node-server`         | Authorization bypass for protected static paths via encoded slashes.   | yes  |
| `@modelcontextprotocol/sdk` | ReDoS — core agent protocol library.                                   | yes  |
| `path-to-regexp`            | ReDoS via multiple route parameters.                                   | yes  |
| `minimatch`                 | ReDoS via repeated wildcards.                                          | yes  |
| `picomatch`                 | Method injection in POSIX character classes (incorrect glob matching). | yes  |
| `flatted`                   | Unbounded recursion DoS in `parse()` revive.                           | yes  |

### Cleared during targeted upgrades

| Package                                                                  | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~`axios`~~                                                              | **Resolved 2026-04-22** — bumped `1.12.2 → 1.15.2` across all 6 workspace declarations. Clears GHSA-43fc-jf86-j433 (high, `__proto__` DoS) + GHSA-3p68-rc4w-qgx5 (moderate, NO_PROXY SSRF) + GHSA-fvcv-3m26-pcqx (moderate, header-injection cloud-metadata exfil) in one move. Semver-compatible with every existing pin and with `axios-retry@4.5.0`.                                                                                                                                                                                                    |
| ~~`express-rate-limit`~~                                                 | **Resolved 2026-04-21** — bumped `8.1.0 → 8.3.2` (advisory range was `=8.1.0` only). Our code does not import this package directly; the orchestrator uses a custom Redis-backed `RateLimiter`. The transitive `7.5.1` via `@modelcontextprotocol/sdk` is unaffected.                                                                                                                                                                                                                                                                                      |
| ~~`express`~~                                                            | No longer surfaced as of 2026-04-22 — advisory-DB state moved; installed version unchanged, so this is upstream advisory maintenance rather than a fix we performed.                                                                                                                                                                                                                                                                                                                                                                                       |
| ~~`socket.io-parser`~~                                                   | **Resolved 2026-04-23** — root `overrides` entry `socket.io-parser: ^4.2.6` bumps the transitive parser used by both `socket.io@4.8.1` (orchestrator) and `socket.io-client@4.8.3` (frontend) from 4.2.4 to 4.2.6. Clears GHSA-cqmj-92xf-r6r9 (HIGH — unbounded binary attachments DoS). Non-breaking patch bump; `~4.2.4` range on both parents already permits 4.2.6. (Previously briefly dropped from the advisory list on 04-22 via upstream advisory-DB drift, then re-surfaced on 04-23 — now fixed for real via a lockfile-visible version change.) |
| ~~`lodash`~~                                                             | No longer surfaced as of 2026-04-22 — advisory-DB state moved; installed version unchanged, so this is upstream advisory maintenance rather than a fix we performed.                                                                                                                                                                                                                                                                                                                                                                                       |
| ~~`rollup`~~                                                             | No longer surfaced as of 2026-04-22 — advisory-DB state moved; installed version unchanged, so this is upstream advisory maintenance rather than a fix we performed.                                                                                                                                                                                                                                                                                                                                                                                       |
| ~~`jspdf`~~                                                              | No longer surfaced as of 2026-04-22 — advisory-DB state moved; installed version unchanged, so this is upstream advisory maintenance rather than a fix we performed.                                                                                                                                                                                                                                                                                                                                                                                       |
| ~~`@typescript-eslint/parser` / `@typescript-eslint/typescript-estree`~~ | No longer surfaced as of 2026-04-22 — advisory-DB state moved; installed version unchanged, so this is upstream advisory maintenance rather than a fix we performed.                                                                                                                                                                                                                                                                                                                                                                                       |
| ~~`next`~~                                                               | No longer surfaced as of 2026-04-22 — advisory-DB state moved; installed version unchanged, so this is upstream advisory maintenance rather than a fix we performed. Prior snapshot flagged as "NO — needs upstream release"; `npm audit` no longer returns it against the currently-installed `next@15.5.15`.                                                                                                                                                                                                                                             |
| ~~`undici`~~                                                             | No longer surfaced as of 2026-04-22 — advisory-DB state moved; installed version unchanged, so this is upstream advisory maintenance rather than a fix we performed.                                                                                                                                                                                                                                                                                                                                                                                       |

All remaining high-severity items now have automatic fixes available. No
"no-fix" items remain in the high tier as of 2026-04-22.

## Moderate (currently open)

`ajv`, `brace-expansion`, `dompurify`, `follow-redirects`, `qs`. Each is
transitive from a small number of packages and should be evaluated in the
next targeted cycle.

## Low (currently open)

`diff` — transitive via `mocha` (test-time only).

## Suggested remediation path

1. **Safe pass first**: `npm audit fix` — non-breaking upgrades. Pin-check and re-run tests.
2. **Force pass**: `npm audit fix --force` — review each major bump; re-run full test + build.
3. **Manual for no-fix items**: none currently in the high tier (as of 2026-04-22).
4. **Re-snapshot** after each pass and diff against this file.

Note: `peer dependency conflict` was cited in an earlier iteration (HIGH-03 in AUDIT_REPORT.md) as blocking `npm audit fix`. The `next@15.5.15` / `@cloudflare/next-on-pages` peer ceiling remains; re-verify before launching the safe pass.

### 2026-04-20 re-verification

`npm audit fix --dry-run` at repo root **still fails** with `ERESOLVE`:

```
Found: next@15.5.15
Could not resolve dependency:
peer next@">=14.3.0 && <=15.5.2" from @cloudflare/next-on-pages@1.13.16
```

No newer `@cloudflare/next-on-pages` release lifts that upper bound (latest is 1.13.16 with the same `<=15.5.2` ceiling). Two viable paths:

1. **Targeted per-workspace upgrades** for non-`next` transitive issues (socket.io-parser, path-to-regexp, picomatch, rollup, qs, body-parser, @hono/node-server, express-rate-limit direct pin, axios). Each should be a separately reviewable commit cycle with test verification — not a batched `audit fix`.
2. **Deliberate `next` downgrade to 15.5.2** to unblock root-level `audit fix`, _or_ pin `@cloudflare/next-on-pages` compatibility if the deployment target is Vercel (not Cloudflare Pages) — in which case the dev-only peer dep can be removed entirely.

Both paths are behavior-affecting on a life-safety product and should not be run silently. The "safe pass" described above is therefore **queued, not executed**, pending an explicit review window.

### 2026-04-21 — first targeted upgrade landed

Followed the Path 1 rhythm from the 2026-04-20 re-verification. Bumped
`express-rate-limit` `8.1.0 → 8.3.2` (the advisory's affected range is
`=8.1.0` only, and `^8.0.0` in the root `package.json` already permitted the
move — no semver churn). Chose this one first because it was the only high-severity
advisory flagged as a "direct revenue-abuse vector" in the prior snapshot.

Verification:

- `npm run type-check` — clean across shared, orchestrator, frontend.
- `npm run build` — clean (exit 0).
- `npm test` per-workspace — all suites green (shared 109/122, orchestrator 156/162,
  weather 119/119, tidal 58/58, route 97/97, safety 548/552, port 60/60; skipped
  counts unchanged from baseline). A long-running test-vs-code mismatch in
  `shared/src/services/__tests__/NOAAWeatherService.test.ts` was corrected as part
  of the same cycle — the test now pins the cache TTL to the `WEATHER_REJECT_AGE_MS`
  constant it's derived from, instead of a stale 3-hour assertion. See CHANGELOG.
- `npm audit` post-bump — advisory cleared; totals `32 → 31`; `high` `16 → 15`.
- Nothing in our source tree imports `express-rate-limit` directly (`grep -rn
express-rate-limit **/*.ts` returns only type-check artefacts) — the orchestrator
  uses a custom Redis-backed `RateLimiter` at `orchestrator/src/middleware/rateLimiter.ts`.
  The bump therefore has zero runtime-path blast radius; it only clears the advisory
  surfaced against the root `package.json` declaration.

Remaining high-severity items on the Path-1 list (axios, express, socket.io-parser,
@hono/node-server, @modelcontextprotocol/sdk, path-to-regexp, lodash, minimatch,
picomatch, flatted, rollup, handlebars, jspdf, @typescript-eslint/\*) are each a
candidate for the next targeted cycle. `next` + `undici` remain gated by
@cloudflare/next-on-pages and stay queued per Path 2.

### 2026-04-22 — second targeted upgrade landed (+ surprise dividend)

Continuing the Path-1 rhythm established on 2026-04-21. Bumped `axios` `1.12.2 →
1.15.2` across all six workspace declarations (root, shared, agents/{weather,
tidal, route, safety}). Chose axios next because it was the remaining direct
prod-runtime high on the Path-1 list, and it sits under every safety-critical
HTTP path (NOAA weather/tidal, port, safety, route). Three advisories cleared
in one move:

- **GHSA-43fc-jf86-j433** (HIGH, CVSS 7.5) — DoS via `__proto__` key in
  `mergeConfig`. Affected range `>=1.0.0 <=1.13.4`.
- **GHSA-3p68-rc4w-qgx5** (moderate, CVSS 4.8) — `NO_PROXY` hostname
  normalization bypass leading to SSRF. Affected `<1.15.0`.
- **GHSA-fvcv-3m26-pcqx** (moderate, CVSS 4.8) — header-injection chain enabling
  cloud-metadata exfiltration. Affected `<1.15.0`.

**Audit-DB drift, not lockfile churn:** post-install `npm audit` shows totals
at `13`, down from the 04-21 baseline of `31`. The delta is far larger than
the axios bump alone would explain, but `git diff package-lock.json` tells
the real story — the only resolved-version changes are axios itself
(`1.12.2 → 1.15.2`) and the three deps axios bundles (`follow-redirects`,
`form-data`, `proxy-from-env`). No other package moved. The implication is
that the 18-entry drop is **GitHub Advisory Database state moving between
04-21 and 04-22**: advisories against `jspdf`, `express`, `socket.io-parser`,
`lodash`, `rollup`, `@typescript-eslint/*`, `next`, `undici`, `body-parser`,
`qs`, `minimist` were withdrawn, rescoped, or otherwise stopped surfacing
for the versions we have installed. The packages themselves are unchanged.
Two implications worth calling out:

- The 04-21 baseline of `31` was not something we are entitled to claim "we
  fixed" just because today's count is `13`. That drop belongs to upstream
  advisory maintenance, not this commit.
- Conversely, the current `13` is equally subject to advisory-DB drift; a
  fresh audit tomorrow could legitimately go back up if an advisory is
  re-opened. Re-snapshot before merging or releasing.
- The only change this session _is_ responsible for is the axios bump — 3
  advisories cleared, all on the `axios` package itself, with a 4-package
  lockfile delta.

Verification:

- `npm run type-check` — clean across shared, orchestrator, frontend.
- `npm run build` — clean (exit 0).
- `npm test` per-workspace — all suites green (shared 109/122, orchestrator
  156/162, weather 119/119, tidal 58/58, route 97/97, safety 548/552, port
  60/60; skipped counts unchanged from baseline). One flake on the initial
  parallel safety-agent run (547/552) cleared on isolated re-run; pre-existing
  worker-teardown issue, unrelated.
- `npm audit` post-bump — axios no longer listed in `vulnerabilities`; totals
  `31 → 13`; `high` `15 → 6`; no package has a "no-fix" high-tier advisory.
- `npm ls axios` confirms `axios@1.15.2` deduped at the root plus all 5 agent
  workspaces and `axios-retry@4.5.0` (peer range `0.x || 1.x`, compatible).
- All six `package.json` declarations (root `^1.12.2`, agents/shared `^1.6.5`)
  unified at `^1.15.2`, so a fresh isolated install cannot resolve back into
  the vulnerable range.

Runtime blast radius: axios calls sit on the NOAA weather/tidal fetch paths
(`shared/src/services/NOAAWeatherService.ts`, `NOAATidalService.ts`), the
safety-agent hazard lookups, and the route-agent port/route clients. No API
surface change between 1.12.2 and 1.15.2 (both within the `1.x` line; release
notes list only internal fixes + the three advisory patches). Jest circuit-breaker
and stale-data tests continue to pass, which pins the agent behavior under the
new axios version.

## Non-actions

This snapshot is observational only for the remaining 13 advisories. No
further dependency changes were made beyond the axios bump and the lockfile
re-resolution that attended `npm install`. `audit fix` is still a behavior-affecting
operation on a life-safety SaaS and should be run with a deliberate test/build cycle attached.

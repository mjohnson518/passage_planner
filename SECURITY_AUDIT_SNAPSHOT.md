# npm audit snapshot — 2026-04-21

Pre-launch vulnerability baseline captured via `npm audit` at the monorepo root.
Delta from AUDIT_REPORT.md "9 npm vulnerabilities" line: **significantly worse**.

## Totals

| Severity  | Count  |
| --------- | ------ |
| critical  | 2      |
| high      | 15     |
| moderate  | 11     |
| low       | 3      |
| **total** | **31** |

Dependencies scanned: 1,905 (prod/dev/optional/peer split unchanged).

**Delta vs 2026-04-20 snapshot:** one `high` cleared — `express-rate-limit` bumped
from the vulnerable `8.1.0` to `8.3.2` (non-breaking within the existing `^8.0.0`
pin), patching GHSA-46wh-pxpv-q5gq (IPv4-mapped IPv6 bypass, CVSS 7.5). Totals
moved `32 → 31`; `high` moved `16 → 15`. All other lines are unchanged — the
`next@15.5.15` / `@cloudflare/next-on-pages` peer-conflict ceiling is still in
place and continues to block a root-level `npm audit fix`.

## Critical — immediate attention

| Package      | Where it bites us                                                                                                                                                                                                                                                                                     | Fix available? |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `handlebars` | JavaScript injection via `@partial-block` AST type confusion. **Reachability note (2026-04-20):** transitive via `ts-jest` only — **dev-only**, not in prod runtime. Still worth fixing during the next dep pass, but not a prod RCE vector today.                                                    | yes            |
| `jspdf`      | Local file inclusion / path traversal. Used for passage PDF export. **Reachability note (2026-04-20):** export runs **client-side** in the browser — there is no server-side render path. Damage surface is the user's own session; severity in practice is moderate, not critical, on this codebase. | yes            |

## High — fix before production

Prototype-pollution / DoS / ReDoS / bypass issues, in rough launch-risk order:

| Package                                                              | Summary                                                                                                                                                                                                                                                                                                                | Fix?                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `axios`                                                              | DoS via `__proto__` in `mergeConfig` (weather API client path).                                                                                                                                                                                                                                                        | yes                                                                        |
| `express`                                                            | DoS advisory on the Express version currently pinned (orchestrator backbone).                                                                                                                                                                                                                                          | yes                                                                        |
| ~~`express-rate-limit`~~                                             | ~~IPv4-mapped IPv6 bypass on dual-stack hosts.~~ **Resolved 2026-04-21** — bumped `8.1.0 → 8.3.2` (advisory range was `=8.1.0` only). Our code does not import this package directly; the orchestrator uses a custom Redis-backed `RateLimiter`. The transitive `7.5.1` via `@modelcontextprotocol/sdk` is unaffected. | fixed                                                                      |
| `socket.io-parser`                                                   | Unbounded binary attachments (planner WebSocket).                                                                                                                                                                                                                                                                      | yes                                                                        |
| `@hono/node-server`                                                  | Authorization bypass for protected static paths via encoded slashes.                                                                                                                                                                                                                                                   | yes                                                                        |
| `@modelcontextprotocol/sdk`                                          | ReDoS — core agent protocol library.                                                                                                                                                                                                                                                                                   | yes                                                                        |
| `path-to-regexp`                                                     | ReDoS via multiple route parameters.                                                                                                                                                                                                                                                                                   | yes                                                                        |
| `lodash`                                                             | Prototype pollution in `_.unset`/`_.omit`.                                                                                                                                                                                                                                                                             | yes                                                                        |
| `minimatch`                                                          | ReDoS via repeated wildcards.                                                                                                                                                                                                                                                                                          | yes                                                                        |
| `picomatch`                                                          | Method injection in POSIX character classes causes incorrect glob matching.                                                                                                                                                                                                                                            | yes                                                                        |
| `flatted`                                                            | Unbounded recursion DoS in `parse()` revive.                                                                                                                                                                                                                                                                           | yes                                                                        |
| `rollup`                                                             | Arbitrary file write via path traversal (build-time only).                                                                                                                                                                                                                                                             | yes                                                                        |
| `handlebars` (repeated)                                              | (see Critical above)                                                                                                                                                                                                                                                                                                   | yes                                                                        |
| `jspdf` (repeated)                                                   | (see Critical above)                                                                                                                                                                                                                                                                                                   | yes                                                                        |
| `@typescript-eslint/parser` / `@typescript-eslint/typescript-estree` | dev-only ReDoS path.                                                                                                                                                                                                                                                                                                   | yes                                                                        |
| **`next`**                                                           | **Self-hosted Next.js DoS via Image Optimizer `remotePatterns` config.**                                                                                                                                                                                                                                               | **NO — needs upstream release / mitigation via config review.**            |
| **`undici`**                                                         | **Unbounded decompression chain in Node.js Fetch API via `Content-Encoding` — resource exhaustion.** Transitive via `miniflare` (Wrangler dev tooling).                                                                                                                                                                | **NO — upstream fix not yet in the version resolvable from our dep tree.** |

Two of the high-severity items have **no automatic fix**. Both are reachable in prod:

- `next` — will affect any self-hosted Vercel/Next deployment with remote image optimization. If hosting via Vercel itself, risk is mitigated by Vercel's own image pipeline; if self-hosting (e.g. Cloudflare Workers), this is load-bearing.
- `undici` — our direct dep tree pulls it only via `miniflare` (dev). Production code using Node 18+ native fetch could still be exposed if the runtime's bundled `undici` is affected; worth verifying Node version at deploy.

## Suggested remediation path

1. **Safe pass first**: `npm audit fix` — non-breaking upgrades. Pin-check and re-run tests.
2. **Force pass**: `npm audit fix --force` — review each major bump; re-run full test + build.
3. **Manual for no-fix items**: upgrade `next` when a patched minor lands; for `undici`, confirm production runtime isn't on the vulnerable surface (native fetch compressions), pin `miniflare` away from the vulnerable range if feasible.
4. **Re-snapshot** after each pass and diff against this file.

Note: `peer dependency conflict` was cited in an earlier iteration (HIGH-03 in AUDIT_REPORT.md) as blocking `npm audit fix`. Re-verify that conflict is still present before launching the fix — it may have been resolved by intervening upgrades.

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

## Non-actions

This snapshot is observational only. No dependency changes were made — `audit fix` is a behavior-affecting operation on a life-safety SaaS and should be run with a deliberate test/build cycle attached.

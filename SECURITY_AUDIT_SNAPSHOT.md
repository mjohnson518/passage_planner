# npm audit snapshot — 2026-04-20

Pre-launch vulnerability baseline captured via `npm audit` at the monorepo root.
Delta from AUDIT_REPORT.md "9 npm vulnerabilities" line: **significantly worse**.

## Totals

| Severity  | Count  |
| --------- | ------ |
| critical  | 2      |
| high      | 16     |
| moderate  | 11     |
| low       | 3      |
| **total** | **32** |

Dependencies scanned: 1,904 (1,080 prod, 803 dev, 27 optional, 1 peer).

## Critical — immediate attention

| Package      | Where it bites us                                                                                                                                                                 | Fix available? |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `handlebars` | JavaScript injection via `@partial-block` AST type confusion. Likely transitive via email-template tooling — any template rendered from user-influenced input is a RCE risk.      | yes            |
| `jspdf`      | Local file inclusion / path traversal. Used for passage PDF export — an attacker-crafted export target could be abused to read local files if any server-side render path exists. | yes            |

## High — fix before production

Prototype-pollution / DoS / ReDoS / bypass issues, in rough launch-risk order:

| Package                                                              | Summary                                                                                                                                                 | Fix?                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `axios`                                                              | DoS via `__proto__` in `mergeConfig` (weather API client path).                                                                                         | yes                                                                        |
| `express`                                                            | DoS advisory on the Express version currently pinned (orchestrator backbone).                                                                           | yes                                                                        |
| `express-rate-limit`                                                 | IPv4-mapped IPv6 addresses bypass per-client rate limiting on dual-stack hosts. **Rate-limit bypass is a direct revenue-abuse vector.**                 | yes                                                                        |
| `socket.io-parser`                                                   | Unbounded binary attachments (planner WebSocket).                                                                                                       | yes                                                                        |
| `@hono/node-server`                                                  | Authorization bypass for protected static paths via encoded slashes.                                                                                    | yes                                                                        |
| `@modelcontextprotocol/sdk`                                          | ReDoS — core agent protocol library.                                                                                                                    | yes                                                                        |
| `path-to-regexp`                                                     | ReDoS via multiple route parameters.                                                                                                                    | yes                                                                        |
| `lodash`                                                             | Prototype pollution in `_.unset`/`_.omit`.                                                                                                              | yes                                                                        |
| `minimatch`                                                          | ReDoS via repeated wildcards.                                                                                                                           | yes                                                                        |
| `picomatch`                                                          | Method injection in POSIX character classes causes incorrect glob matching.                                                                             | yes                                                                        |
| `flatted`                                                            | Unbounded recursion DoS in `parse()` revive.                                                                                                            | yes                                                                        |
| `rollup`                                                             | Arbitrary file write via path traversal (build-time only).                                                                                              | yes                                                                        |
| `handlebars` (repeated)                                              | (see Critical above)                                                                                                                                    | yes                                                                        |
| `jspdf` (repeated)                                                   | (see Critical above)                                                                                                                                    | yes                                                                        |
| `@typescript-eslint/parser` / `@typescript-eslint/typescript-estree` | dev-only ReDoS path.                                                                                                                                    | yes                                                                        |
| **`next`**                                                           | **Self-hosted Next.js DoS via Image Optimizer `remotePatterns` config.**                                                                                | **NO — needs upstream release / mitigation via config review.**            |
| **`undici`**                                                         | **Unbounded decompression chain in Node.js Fetch API via `Content-Encoding` — resource exhaustion.** Transitive via `miniflare` (Wrangler dev tooling). | **NO — upstream fix not yet in the version resolvable from our dep tree.** |

Two of the high-severity items have **no automatic fix**. Both are reachable in prod:

- `next` — will affect any self-hosted Vercel/Next deployment with remote image optimization. If hosting via Vercel itself, risk is mitigated by Vercel's own image pipeline; if self-hosting (e.g. Cloudflare Workers), this is load-bearing.
- `undici` — our direct dep tree pulls it only via `miniflare` (dev). Production code using Node 18+ native fetch could still be exposed if the runtime's bundled `undici` is affected; worth verifying Node version at deploy.

## Suggested remediation path

1. **Safe pass first**: `npm audit fix` — non-breaking upgrades. Pin-check and re-run tests.
2. **Force pass**: `npm audit fix --force` — review each major bump; re-run full test + build.
3. **Manual for no-fix items**: upgrade `next` when a patched minor lands; for `undici`, confirm production runtime isn't on the vulnerable surface (native fetch compressions), pin `miniflare` away from the vulnerable range if feasible.
4. **Re-snapshot** after each pass and diff against this file.

Note: `peer dependency conflict` was cited in an earlier iteration (HIGH-03 in AUDIT_REPORT.md) as blocking `npm audit fix`. Re-verify that conflict is still present before launching the fix — it may have been resolved by intervening upgrades.

## Non-actions

This snapshot is observational only. No dependency changes were made — `audit fix` is a behavior-affecting operation on a life-safety SaaS and should be run with a deliberate test/build cycle attached.

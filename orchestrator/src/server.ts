// orchestrator/src/server.ts
//
// DEPRECATED — DO NOT REVIVE THIS FILE.
//
// What this file was
// ------------------
// `HttpServer` (the class formerly defined here) wrapped the orchestrator
// in an Express app with auth, billing, profile, fleet, admin, dashboard,
// feedback, and CronService scheduling. It was excluded from the build
// (`orchestrator/tsconfig.json` "exclude" → "src/server.ts") because its
// top-of-file `import { OrchestratorService } from "./index"` referenced
// a class that no longer exists — production has run
// `SimpleOrchestrator` (`./SimpleOrchestrator.ts`) for some time.
//
// What replaced it
// ----------------
// Routes migrated into `SimpleOrchestrator` (see git history for the
// reference implementations):
//   - POST /api/auth/logout              (B2)
//   - GET / PUT /api/profile             (B2)
//   - GET /api/founding-member/spots-remaining   (B2)
//   - POST /api/stripe/webhook (raw body + idempotency)   (B3)
//   - POST /api/subscription/create-checkout-session       (B3)
//   - POST /api/subscription/customer-portal               (B3)
//   - POST /api/fleet/create                               (B5)
//   - GET /api/fleet                                       (B5)
//   - GET / POST /api/fleet/:fleetId/vessels              (B5)
//   - GET /api/fleet/:fleetId/members                     (B5)
//   - POST /api/fleet/:fleetId/invite                     (B5)
//   - POST /api/fleet/invitations/:token/accept           (B5)
//   - POST /api/fleet/invitations/:token/reject           (B5)
//   - CronService.start() in SimpleOrchestrator.start()    (B4)
//
// What still needs migration
// --------------------------
// These routes existed in the old HttpServer and the frontend still
// calls them through its Next.js API proxies. Until a follow-up commit
// migrates them, they 404 in production (frontend handles the error
// path gracefully but the feature is offline):
//
//   - GET /api/dashboard/stats        (called by frontend/app/dashboard)
//   - POST /api/feedback              (FeedbackWidget)
//   - GET / POST /api/boats           (boat-profile management)
//   - GET /api/weather/current        (lightweight weather card)
//   - GET /api/passages/:id           (single-passage detail)
//   - POST /api/passages/:id/export   (per-passage GPX/PDF export)
//   - POST /api/passages/export/bulk  (multi-passage export)
//   - POST /api/subscription/purchase-top-up   (Premium top-up packs)
//   - GET /api/usage/summary          (settings billing tab)
//   - POST /api/auth/signup, /api/auth/login, /api/auth/refresh
//       (auth runs via Supabase in production; these are CSRF-protected
//        cookie endpoints that the frontend uses opportunistically)
//   - GET /api/user/data-export, POST /api/user/delete  (privacy page)
//   - POST /api/user/api-key, /api/user/api-key/generate (Pro tier)
//   - GET /api/admin/users / metrics / revenue / system / analytics
//       (admin pages — feature-flagged, not user-facing)
//   - GET /api/agents/health/detailed   (admin agent monitor)
//
// Migration playbook
// ------------------
// For each route group:
//   1. Copy the implementation from the git history of this file (use
//      `git log -p -- orchestrator/src/server.ts` and grep the path).
//   2. Adapt to SimpleOrchestrator conventions:
//        - replace `...this.authChain()` with
//          `const userId = await this.verifyAuthAndGetUserId(req, res);
//           if (!userId) return;`
//        - replace `this.rateLimiter!.limit.bind(this.rateLimiter!)` with
//          `await this.checkRateLimit(req, res, { bucket: <name>, limit: N })`
//        - reuse `this.postgres`, `this.stripeService`, `emailService`,
//          `getSubscription`/`updateSubscription` helpers already in place.
//   3. Type-check + manual smoke test before committing.
//
// Why this stub still exists
// --------------------------
// `git rm` would lose the deprecation breadcrumb at the original path,
// and the file appears in old documentation, runbooks, and search results.
// A short documentation-only file is cheaper than a confused new joiner.

export const __DEAD_SERVER_FILE__ = true;

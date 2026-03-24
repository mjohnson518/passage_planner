---
name: Production Readiness Audit Implementation
description: Summary of 35 findings addressed in the production readiness audit
type: project
---

Production readiness audit was run and 35 findings were identified. A large batch was implemented in March 2026.

**Why:** Helmwise is life-safety maritime infrastructure — safety, security, and compliance take absolute precedence.

**How to apply:** When reviewing code changes, refer to this list to understand what has been hardened.

## Implemented (March 2026)

### Safety (Phase 1)
- Created `shared/src/constants/safety-thresholds.ts` — single source of truth for WEATHER_REJECT_AGE_MS (1hr), WEATHER_WARN_AGE_MS (30min), TIDAL_REJECT_AGE_MS (24hr), KEEL_CLEARANCE_FACTOR (1.2), WEATHER_DELAY_FACTOR (1.2), FUEL_WATER_RESERVE_FACTOR (1.3), PLAN_STATUS enum
- Updated `data-freshness.ts` to use constants (was hardcoded 3hr — now 1hr per CLAUDE.md)
- `SimpleOrchestrator` imports and uses the constants for staleness thresholds
- Passage plan now includes `status: PLAN_STATUS.OK | PLAN_STATUS.SAFETY_UNVERIFIED`
- 20% weather delay buffer (WEATHER_DELAY_FACTOR) applied to all direct routes
- Frontend planner: persistent non-dismissible safety disclaimer + red SAFETY_UNVERIFIED banner
- Area checker: upgraded from fixed 20-point to distance-adaptive sampling (1pt/nm, min 50)

### Security (Phase 2)
- `orchestrator/src/index.ts`: startup aborts if SKIP_AUTH=true or JWT_SECRET missing in production
- `SimpleOrchestrator.verifyAuth()`: triple-checked dev bypass (requires !production + SKIP_AUTH + DEV_AUTH_BYPASS_KEY)
- `AuthService`: throws on missing JWT_SECRET in production (was silently using random key)
- `server.ts`: auth rate limiting wired to /api/auth/signup and /api/auth/login
- `server.ts`: Zod input validation on signup (email, 12-char min password) and login endpoints
- `rateLimiter.ts`: auth endpoints fail closed (503) in production when Redis unavailable
- Error messages sanitized — no raw `error.message` returned to clients from planning endpoints

### Infrastructure (Phase 4)
- `EmailService.ts`: all "Passage Planner" → "Helmwise", from address → `noreply@helmwise.co`
- All email templates: CAN-SPAM compliant unsubscribe footer + List-Unsubscribe headers added

### Frontend / Legal (Phase 3, 5)
- 3 error boundary files: `app/error.tsx`, `app/planner/error.tsx`, `app/dashboard/error.tsx`
- Cookie consent banner (`CookieConsent.tsx`) added to layout
- Sitemap expanded from 6 → 16 public routes
- OG image metadata added to layout (openGraph.images + twitter.images)
- JSON-LD Organization schema on homepage
- Next.js image optimization re-enabled (was `unoptimized: true`)

## Still To Do (from original 35)
- 1.3 Zod validation for NOAA/OpenWeather API responses
- 1.4 Backend fuel/water reserve enforcement
- 1.6 Production WeatherAgent tests (`agents/weather/src/__tests__/index.test.ts`)
- 2.5 Wire InputValidation middleware to all POST/PUT routes (~15 endpoints)
- 2.6 Rate limiting to all authenticated endpoints
- 2.7 WebSocket connection rate limiting
- 3.1 Fix WebSocket protocol mismatch (raw WS vs Socket.IO)
- 3.2 Add WebSocket authentication
- 4.1 Multi-stage Docker builds
- 4.6 Complete Stripe customer portal endpoint
- 5.2 Improve ARIA accessibility
- 6.1 Migrate from deprecated @supabase/auth-helpers-nextjs → @supabase/ssr
- 6.3 Migrate auth token from localStorage to httpOnly cookies

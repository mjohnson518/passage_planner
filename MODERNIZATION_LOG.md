# Helmwise Frontend Modernization Log

> **Phase 1: Discovery & Baseline Capture**
> Generated: 2026-02-10
> Status: In Progress

---

## 1. Framework & Build Configuration

| Dependency | Version | Notes |
|-----------|---------|-------|
| Next.js | 15.5.9 | App Router only, no Pages Router |
| React | 18.x | |
| React DOM | 18.x | |
| TypeScript | 5.8.3 (root), 5.x (frontend) | |
| Node.js types | ^20 | |
| ESLint | 8.57.1 | eslint-config-next 14.0.3 |
| Prettier | 3.6.2 | |

### TypeScript Configuration

| Setting | Frontend | Root |
|---------|----------|------|
| `strict` | **false** | true |
| `target` | es5 | ES2022 |
| `module` | esnext | commonjs |
| `jsx` | preserve | — |
| `incremental` | true | — |
| `isolatedModules` | true | — |
| `skipLibCheck` | true | true |

### Next.js Build Config (`frontend/next.config.js`)

```
reactStrictMode: true
typescript.ignoreBuildErrors: true  ← TEMPORARY, masks prop mismatches
eslint.ignoreDuringBuilds: false
experimental.scrollRestoration: true
images.unoptimized: true  ← No next/image optimization
webpack: fs/net/tls set to false (Node polyfill suppression)
```

**Key issues:**
- `ignoreBuildErrors: true` — suppresses TypeScript errors at build time
- `strict: false` in frontend tsconfig — weaker type checking
- `images.unoptimized: true` — no automatic image optimization

---

## 2. Styling & Design System

### CSS Architecture
- **Framework:** Tailwind CSS 3.3.0 with PostCSS + Autoprefixer
- **Dark mode:** Class-based via `next-themes` (`darkMode: ["class"]`)
- **Design system:** CSS custom properties (HSL format) + Tailwind theme extension
- **Component styling:** Utility-first with `clsx`, `class-variance-authority`, `tailwind-merge`
- **Plugins:** `tailwindcss-animate`, `@tailwindcss/forms`, `@tailwindcss/typography`

### Color Palette — Light Mode (Maritime Cartography)

| Token | HSL Value | Purpose |
|-------|-----------|---------|
| `--background` | 40 33% 98% | Page background |
| `--foreground` | 220 30% 12% | Primary text |
| `--primary` | 205 85% 28% | Deep Ocean — primary actions |
| `--primary-foreground` | 40 30% 98% | Text on primary |
| `--secondary` | 35 40% 92% | Warm Sand |
| `--accent` | 38 70% 50% | Compass Brass |
| `--muted` | 40 20% 94% | Subdued backgrounds |
| `--muted-foreground` | 220 15% 45% | Secondary text |
| `--destructive` | 0 72% 51% | Errors/danger |
| `--border` | 40 20% 88% | Border color |
| `--ring` | 205 85% 28% | Focus rings |
| `--radius` | 0.625rem | Border radius base |
| `--ocean-deep` | 205 85% 20% | Extended palette |
| `--ocean-mid` | 205 75% 35% | Extended palette |
| `--ocean-light` | 200 65% 55% | Extended palette |
| `--brass` | 38 70% 50% | Brass accent |
| `--brass-dark` | 35 65% 40% | Brass dark |
| `--parchment` | 40 33% 96% | Parchment background |
| `--ink` | 220 30% 15% | Deep text |
| `--success` | 158 64% 40% | Success states |
| `--warning` | 38 92% 50% | Warning states |
| `--chart-grid` | 205 30% 85% | Chart gridlines |

### Color Palette — Dark Mode (Maritime Night Watch)

| Token | HSL Value |
|-------|-----------|
| `--background` | 220 35% 8% |
| `--foreground` | 40 20% 92% |
| `--primary` | 200 70% 55% |
| `--primary-foreground` | 220 35% 8% |
| `--secondary` | 220 25% 18% |
| `--accent` | 38 75% 55% |
| `--muted` | 220 25% 15% |
| `--muted-foreground` | 220 15% 60% |
| `--destructive` | 0 65% 55% |
| `--border` | 220 25% 20% |
| `--ocean-deep` | 205 70% 50% |
| `--ocean-mid` | 200 65% 45% |
| `--ocean-light` | 195 60% 60% |
| `--brass` | 38 75% 55% |
| `--brass-dark` | 35 70% 45% |
| `--parchment` | 40 15% 15% |
| `--ink` | 40 20% 92% |
| `--success` | 158 55% 50% |
| `--warning` | 38 85% 55% |
| `--chart-grid` | 220 20% 25% |

### Typography

| Role | Font Family | Weights |
|------|------------|---------|
| Display (headings) | Libre Baskerville, Georgia, serif | 400, 700, 400i |
| Body | Source Sans 3, system-ui, sans-serif | 300, 400, 500, 600, 700 |

**Font loading:** ~~Google Fonts `@import url()` in `globals.css`~~ → Migrated to `next/font/google` in Phase 2 (self-hosted, non-blocking, CSS variables `--font-heading` / `--font-body`).

**Heading scale:**
- h1: `text-4xl md:text-5xl lg:text-6xl`
- h2: `text-3xl md:text-4xl`
- h3: `text-xl md:text-2xl`

### Shadows (Custom)

| Name | Value |
|------|-------|
| `maritime` | `0 4px 20px -2px hsl(var(--primary) / 0.15)` |
| `maritime-lg` | `0 20px 40px -15px hsl(var(--primary) / 0.2)` |
| `brass` | `0 4px 14px 0 hsl(var(--brass) / 0.35)` |
| `card` | `0 1px 3px hsl(--foreground/0.05), 0 1px 2px -1px hsl(--foreground/0.05)` |
| `card-hover` | `0 20px 40px -15px hsl(--primary/0.15), 0 8px 16px -8px hsl(--foreground/0.1)` |
| `inner-light` | `inset 0 1px 0 0 hsl(var(--background) / 0.5)` |

### Animations & Keyframes

**Tailwind keyframes (12):**
`accordion-down`, `accordion-up`, `fade-in-up`, `fade-in`, `slide-in-right`, `slide-in-left`, `float`, `compass-needle`, `wave-shift`, `pulse`, `pulse-glow`, `shimmer`, `scale-in`

**CSS keyframes in globals.css (5 additional):**
`skeleton-shimmer`, `wave-shift`, `compass-needle`, `float-gentle`, `fade-in-up`, `pulse-glow`

**Framer Motion:** `framer-motion ^12.23.6` installed — usage appears minimal

### Custom CSS Components (globals.css)

- `.chart-grid` / `.chart-grid-dense` — Nautical chart grid backgrounds
- `.parchment-texture` — SVG noise overlay
- `.glass` / `.glass-heavy` — Glassmorphism with backdrop-blur
- `.card-nautical` — Card with primary top border accent
- `.card-hover` — Elevated hover card state
- `.btn-maritime` / `.btn-primary` / `.btn-secondary` / `.btn-brass` / `.btn-ghost` — Maritime button variants
- `.badge-*` — Status badges (primary, success, warning, error, brass)
- `.skeleton` — Shimmer loading skeleton
- `.section-hero` / `.section-alt` / `.section-ocean` — Section background variants
- `.divider-nautical` — Gradient divider with centered content

---

## 3. Component Library Inventory

### shadcn/ui Components (25 in `frontend/app/components/ui/`)

| Component | Radix Primitive |
|-----------|----------------|
| alert | — |
| badge | — |
| button | — |
| calendar | — (react-day-picker) |
| card | — |
| checkbox | @radix-ui/react-checkbox |
| date-picker | — (custom) |
| dialog | @radix-ui/react-dialog |
| input | — |
| label | @radix-ui/react-label |
| optimized-image | — (custom) |
| popover | @radix-ui/react-popover |
| progress | @radix-ui/react-progress |
| radio-group | @radix-ui/react-radio-group |
| responsive-card | — (custom) |
| scroll-area | @radix-ui/react-scroll-area |
| select | @radix-ui/react-select |
| skeleton | — |
| slider | @radix-ui/react-slider |
| switch | @radix-ui/react-switch |
| table | — |
| tabs | @radix-ui/react-tabs |
| textarea | — |
| theme-toggle | — (custom) |
| toaster | @radix-ui/react-toast |

### Radix UI Packages (13)

`react-checkbox`, `react-dialog`, `react-dropdown-menu`, `react-label`, `react-popover`, `react-progress`, `react-radio-group`, `react-scroll-area`, `react-select`, `react-slider`, `react-switch`, `react-tabs`, `react-toast`

### Domain Components (40+)

**Admin:** AdminOverview, AgentMonitoring, AnalyticsReports, CodeEditor, RevenueMetrics, SystemHealth, UserManagement
**Analytics:** AnalyticsChart, AnalyticsDashboard
**Billing:** StripeCheckout
**Charts:** TideChart, WeatherChart
**Fleet:** AddVesselDialog, CreateFleetDialog, CrewList, FleetAnalyticsDashboard, FleetVesselCard, InviteCrewDialog, SharePassageDialog
**Location:** LocationAutocomplete, PortSelector
**Maps:** InteractiveMap, RouteMap, WeatherOverlay, PassageMap
**Layout:** Header, MobileNav
**Monitoring:** AgentHealthDashboard
**Onboarding:** OnboardingFlow, BoatSetupStep, CompletionStep, PreferencesStep, TutorialStep, WelcomeStep
**Export:** ExportDialog, PDFPreview
**Passages:** RecentPassages
**PWA:** InstallPrompt
**Weather:** WeatherWidget
**Other:** ErrorBoundary, FeedbackWidget, DemoPassage

---

## 4. State Management

### Zustand Store (`frontend/app/store/index.ts`)

Single store: `useStore` with `persist` middleware (localStorage)

**State slices:**
- **Passage Plans:** `passagePlans[]`, `currentPlanId`, CRUD operations (keeps last 5)
- **Chat:** `messages[]` (keeps last 50), `addMessage`, `clearMessages`
- **Map:** `viewport` (lat/lng/zoom), `layers[]` with toggle/add/remove
- **Preferences:** theme, units, mapStyle, language, timezone
- **Offline Queue:** `offlineQueue[]`, add/clear operations
- **Session:** `lastSync` timestamp

**Selectors:** `useCurrentPlan()`, `useVisibleLayers()`, `useOfflineMode()`

**Persistence:** Selective — persists plans, preferences, viewport, layers (without data), offline queue

### React Query (`@tanstack/react-query 5.83.0`)

Used for server state management alongside Zustand for client state.
DevTools included (`@tanstack/react-query-devtools`).

### Socket.io (`socket.io-client 4.8.1`)

Real-time updates between frontend and orchestrator via SocketContext.

---

## 5. Data Fetching Patterns

| Pattern | Usage |
|---------|-------|
| React Query (`useQuery`/`useMutation`) | Server state, API calls |
| Socket.io | Real-time passage planning progress, agent status |
| Supabase client | Auth, direct DB queries |
| Fetch API | Some direct API calls |

---

## 6. Route Map (18 routes)

### Public Routes (7)

| Route | Page |
|-------|------|
| `/` | Landing page |
| `/login` | Authentication |
| `/signup` | Registration |
| `/reset-password` | Password reset |
| `/pricing` | Pricing page |
| `/api-docs` | API documentation |
| `/offline` | Offline mode page |

### Auth-Required Routes (8)

| Route | Page |
|-------|------|
| `/dashboard` | User dashboard |
| `/planner` | Main passage planner |
| `/passages` | Saved passages list |
| `/passages/[id]` | Passage detail view |
| `/fleet` | Fleet management |
| `/weather` | Weather overview |
| `/onboarding` | New user onboarding |
| `/demo` | Demo experience |

### Admin Routes (3)

| Route | Page |
|-------|------|
| `/admin` | Admin overview |
| `/admin/agents` | Agent monitoring |
| `/admin/analytics` | Analytics reports |

---

## 7. Critical User Flows

1. **New User Signup** — `/signup` → email verification → `/onboarding` → `/dashboard`
2. **Passage Planning** — `/planner` → enter departure/arrival → real-time agent processing → view results with maps/charts → export
3. **Fleet Management** — `/fleet` → create fleet → add vessels → invite crew → share passages
4. **Weather Monitoring** — `/weather` → view forecasts → overlay on map → check tidal data
5. **Admin Monitoring** — `/admin` → system health → agent status → analytics → user management

---

## 8. `'use client'` Audit

**Total files with `'use client'` directive: 72**

Breakdown:
- Page components: 15 of 18 route pages
- UI primitives: 12 (dialog, select, label, checkbox, radio-group, calendar, toaster, popover, switch, tabs, theme-toggle, optimized-image)
- Domain components: ~40 (maps, charts, forms, admin panels)
- Contexts: 3 (providers, SocketContext, AuthContext)
- Layout: 1 (dashboard/layout)

**Impact:** Heavy client-side rendering. Most pages are fully client-rendered despite using App Router. Server Components are underutilized.

---

## 9. Heavy Third-Party Dependencies

| Package | Version | Bundle Impact | Notes |
|---------|---------|--------------|-------|
| leaflet + react-leaflet | 1.9.4 / 4.2.1 | ~150KB | Maps — no dynamic import observed |
| recharts | 3.1.0 | ~180KB | Charts — client only |
| framer-motion | 12.23.6 | ~120KB | Minimal usage, heavy import |
| html2canvas | 1.4.1 | ~200KB | PDF export |
| jspdf | 3.0.1 | ~300KB | PDF export |
| react-syntax-highlighter | 15.6.1 | ~80KB | API docs code blocks |
| d3 | 7.9.0 | ~250KB | Full D3 bundle (root dep) |
| @sentry/nextjs | 10.27.0 | ~100KB | Error tracking |
| @supabase/supabase-js | 2.51.0 | ~50KB | Auth & DB |
| socket.io-client | 4.8.1 | ~50KB | Real-time |

---

## 10. External Services

| Service | Purpose | Env Vars |
|---------|---------|----------|
| Supabase | Auth + PostgreSQL + RLS | `NEXT_PUBLIC_SUPABASE_*` |
| Redis/Upstash | Caching, rate limiting | `REDIS_URL` |
| Stripe | Payments, subscriptions | `STRIPE_*` |
| NOAA | Primary weather data | `NOAA_API_KEY` |
| OpenWeather | Weather backup | `OPENWEATHER_API_KEY` |
| Sentry | Error tracking | `SENTRY_DSN` |
| Resend | Transactional email | `RESEND_API_KEY` |
| Google Maps | Location autocomplete | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |

---

## 11. Testing Infrastructure

### Jest (Unit/Integration)
- Frontend: Jest 30.0.4, jsdom environment, 85% coverage threshold
- Orchestrator/Agents: Jest 29.7.0
- Testing Library: `@testing-library/react` 16.3.0

### Playwright (E2E)
- Config exists at `tests/playwright.config.ts`
- **Missing:** `global-setup.ts` and `global-teardown.ts` (referenced but don't exist)
- 7 browser projects configured (Chromium, Firefox, WebKit, Mobile Chrome/Safari, Edge, Chrome)
- 2 existing spec files: `auth.spec.ts`, `passage-planning.spec.ts`
- `@playwright/test` not installed as devDependency (needs to be added)

### Bundle Analyzer
- `webpack-bundle-analyzer` 4.10.2 installed as frontend devDependency
- **Not wired** into next.config.js — needs `ANALYZE` env var setup

---

## 12. Performance Baseline

> Captured: 2026-02-10, dev server on localhost:3000

### Bundle Analysis

**Shared JS (loaded on every page):** 103 KB
- `chunks/3131-*.js` — 46 KB
- `chunks/c7879cf7-*.js` — 54.2 KB
- Other shared chunks — 3.03 KB
- Middleware — 33.9 KB

**Heaviest Pages (First Load JS):**

| Route | Page JS | First Load JS |
|-------|---------|--------------|
| `/planner` | 13.5 KB | **406 KB** |
| `/api-docs` | 233 KB | **405 KB** |
| `/admin` | 22.7 KB | **364 KB** |
| `/fleet` | 15.8 KB | **325 KB** |
| `/passages/[id]` | 15.7 KB | **327 KB** |
| `/admin/analytics` | 5.4 KB | **320 KB** |
| `/weather` | 5.73 KB | 206 KB |
| `/passages` | 5.76 KB | 202 KB |
| `/onboarding` | 15.3 KB | 188 KB |
| `/dashboard` | 9.48 KB | 185 KB |
| `/` (landing) | 13.3 KB | 184 KB |
| `/admin/agents` | 8.32 KB | 179 KB |
| `/signup` | 10.7 KB | 178 KB |
| `/login` | 8.15 KB | 176 KB |
| `/pricing` | 9.19 KB | 174 KB |
| `/reset-password` | 5.28 KB | 173 KB |

**Bundle analyzer report:** `frontend/analyze/client.html`

### Lighthouse Scores (Landing Page `/`)

| Metric | Score |
|--------|-------|
| **Performance** | **37** |
| **Accessibility** | **81** |
| **Best Practices** | **96** |
| **SEO** | **100** |

| Web Vital | Value |
|-----------|-------|
| LCP (Largest Contentful Paint) | **19.4 s** |
| CLS (Cumulative Layout Shift) | **0.001** |
| FCP (First Contentful Paint) | **3.1 s** |
| TBT (Total Blocking Time) | **2,060 ms** |
| Speed Index | **5.3 s** |

**Key findings:**
- LCP of 19.4s is extremely slow (target: <2.5s) — likely caused by render-blocking Google Fonts `@import` + heavy client-side JS
- TBT of 2,060ms indicates too much main-thread JavaScript execution
- FCP of 3.1s is above the 1.8s "good" threshold
- CLS is excellent (0.001) — layouts are stable
- SEO is perfect (100)
- Accessibility at 81 has room for improvement

**Lighthouse reports:** `lighthouse-reports/landing.report.{html,json}`

### Screenshot Baselines

- **Total routes captured:** 16 / 16
- **Breakpoints per route:** 4 (mobile 375px, tablet 768px, laptop 1024px, desktop 1440px)
- **Total screenshots:** 64
- **Location:** `tests/e2e/screenshots/baseline/`
- **Notes:**
  - `/offline` returned 500 — error state captured as baseline
  - `/weather`, `/onboarding`, admin routes experienced navigation timeouts (no backend running) — partial load states captured
  - Auth-required routes show redirect-to-login behavior as expected

---

## 13. Known Issues & Technical Debt

1. **TypeScript `strict: false`** in frontend — weaker type safety
2. **`ignoreBuildErrors: true`** — masks TypeScript errors at build
3. **Google Fonts `@import`** — render-blocking, should use `next/font`
4. **`images.unoptimized: true`** — no image optimization
5. **72 `'use client'` files** — underutilized Server Components
6. **Full D3 import** — `d3 ^7.9.0` in root deps, heavy bundle
7. **No code splitting** for heavy libs (leaflet, recharts, html2canvas, jspdf)
8. **Missing Playwright infrastructure** — global-setup/teardown don't exist
9. **Bundle analyzer not wired** — installed but not configured
10. **Duplicate dependencies** — `tailwind-merge` in both root and frontend

---

## Phase 2: Performance Optimization

> **Completed:** 2026-02-11
> **Status:** Complete

### Changes Summary

| Step | Change | Files |
|------|--------|-------|
| 1 | Migrated font loading from `@import url()` to `next/font/google` | layout.tsx, globals.css, tailwind.config.ts |
| 2 | Added `loading.tsx` skeleton screens to 5 heavy routes | planner, admin, fleet, dashboard, api-docs |
| 3 | Code-split 6 admin tab components via `next/dynamic` | LazyComponents.tsx, admin/page.tsx |
| 4 | Lazy-loaded FleetAnalytics (already had wrapper) | fleet/page.tsx |
| 5 | Dynamic import for react-syntax-highlighter + vscDarkPlus theme | api-docs/page.tsx |
| 6 | Replaced framer-motion with CSS `animate-slide-in-right` | OnboardingFlow.tsx, package.json |
| 7 | Removed unused socket.io-client dependency | package.json |
| 8 | Lazy-loaded DemoPassage on dashboard | dashboard/page.tsx |

### Bundle Size: Before → After

| Route | Before | After | Change |
|-------|--------|-------|--------|
| `/admin` | 364 KB | **178 KB** | -51% |
| `/api-docs` | 405 KB | **181 KB** | -55% |
| `/fleet` | 325 KB | **219 KB** | -33% |
| `/passages/[id]` | 327 KB | **328 KB** | — |
| `/dashboard` | 185 KB | **177 KB** | -4% |
| `/onboarding` | 188 KB | **188 KB** | — |
| `/planner` | 406 KB | **407 KB** | — (map already dynamic) |
| Shared JS | 103 KB | **104 KB** | +1 KB |

### Dependencies Removed

- `framer-motion` ^12.23.6 (~25KB gzipped) — replaced with Tailwind CSS animation
- `socket.io-client` ^4.8.1 (~45KB gzipped) — unused, WebSocket is native

### Known Issues Resolved

- **#3** Google Fonts `@import` → migrated to `next/font/google` (self-hosted, non-blocking)
- **#7** No code splitting → admin, fleet analytics, api-docs syntax highlighter, demo passage all lazy-loaded
- **#6** framer-motion → removed entirely, CSS replacement

### Font Loading (Step 1 Detail)

**Before:** Render-blocking `@import url()` in globals.css → browser fetches external CSS → discovers font URLs → downloads fonts → renders text. Primary cause of 19.4s LCP.

**After:** `next/font/google` in layout.tsx self-hosts fonts at build time, applies `font-display: swap`, sets CSS variables `--font-heading` and `--font-body`. Zero external font requests at runtime.

---

## Appendix: File Inventory

### Configuration Files
- `frontend/next.config.js` — Next.js build configuration
- `frontend/tsconfig.json` — Frontend TypeScript config
- `frontend/tailwind.config.ts` — Tailwind theme and plugins
- `frontend/postcss.config.js` — PostCSS configuration
- `frontend/app/globals.css` — Global styles and design tokens
- `tests/playwright.config.ts` — Playwright test configuration

### Key Directories
- `frontend/app/components/ui/` — 25 shadcn/ui components
- `frontend/app/components/` — 40+ domain components
- `frontend/app/store/` — Zustand store
- `frontend/app/hooks/` — Custom hooks (4: use-toast, useAnalytics, usePassagePlanner, useServiceWorker)
- `frontend/app/contexts/` — React contexts (SocketContext, AuthContext)
- `frontend/app/lib/` — Utility functions
- `shared/src/types/` — Core types (boat, core, errors, fleet, passage, safety)
- `shared/src/services/` — Shared services (data-freshness, feature-flags, noaa-api-client, retry, resilience)

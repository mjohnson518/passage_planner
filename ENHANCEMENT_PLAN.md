# Helmwise Enhancement Plan

> **Date:** 2026-02-12
> **Scope:** Comprehensive platform assessment and enhancement roadmap
> **Goal:** Transform Helmwise from a functional passage planner into the tool sailors actually want to use

---

## Current State Assessment

### What Works Well

Helmwise is **not a demo** — it's a functioning maritime SaaS with real data:

- **Real NOAA weather** (NWS API + OpenWeather) with 72hr+ forecasts
- **Real NOAA tidal predictions** (CO-OPS API) with 1000+ US stations
- **Real route calculations** (geolib) with great circle/rhumb line/optimal
- **Real safety checks** — bathymetry (ETOPO), restricted areas, navigation warnings, depth clearance
- **Real port database** — 20+ US East Coast ports with facilities, VHF, customs
- **Production-quality exports** — GPX, PDF, CSV, KML all spec-compliant
- **Safety-first architecture** — audit logging, data freshness rejection, conservative margins
- **Parallel agent execution** — <3 second passage plan generation
- **Subscription tiers** — Free/Premium/Pro/Enterprise with Stripe

### Critical Gaps (What Sailors Would Notice Immediately)

| Gap | Impact | Why It Matters |
|-----|--------|---------------|
| **Wave data is estimated** from wind speed, not real buoy data | HIGH | Sailors making go/no-go decisions need actual sea state |
| **No nautical charts** — OSM basemap shows streets, not depths | CRITICAL | Can't verify route safety visually |
| **No offline mode** despite PWA manifest | CRITICAL | No cell service 20+ miles offshore |
| **Port database is hardcoded** — 20 ports, US East Coast only | HIGH | Useless outside Northeast US |
| **Restricted areas: only 3 hardcoded** | HIGH | Misses thousands of real hazards |
| **No weather routing** — routes ignore wind/current | HIGH | The #1 feature sailors expect from a passage planner |
| **No GRIB file support** | HIGH | Standard offshore weather data format |
| **Vessel draft hardcoded at 5.5ft** | SAFETY | Under-keel clearance calculations wrong for most boats |
| **No tidal current integration into ETA** | MEDIUM | Estimated arrival times unreliable |
| **Stripe webhooks have no API endpoint** | BLOCKER | Subscriptions won't actually sync |
| **No NDBC buoy data** despite service existing in shared/ | MEDIUM | Real observations available but unused |

---

## Enhancement Tiers

### Tier 0: Ship-Blocking Fixes (Before Any Real User)

These must be fixed before anyone should plan a real passage with Helmwise.

#### 0.1 — Vessel Draft in Onboarding & Planner

**Problem:** Draft is hardcoded at 5.5ft. A 45ft sailboat draws 6-7ft. A shoal-draft catamaran draws 3ft. Wrong draft = wrong safety calculations = potential grounding.

**Fix:**
- Add `draft` field to BoatSetupStep (onboarding)
- Add `draft` field to planner input form
- Pass actual draft to SafetyAgent instead of `request.vessel?.draft || 6`
- Store in vessel_profiles table (column already exists)

**Files:** `frontend/app/components/onboarding/steps/BoatSetupStep.tsx`, `frontend/app/planner/page.tsx`, `orchestrator/src/SimpleOrchestrator.ts`

#### 0.2 — Stripe Webhook Endpoint

**Problem:** StripeService.handleWebhook() is fully implemented but no API route exposes it. Subscriptions, payment failures, and cancellations are silently ignored.

**Fix:**
- Create `/api/stripe/webhook` route in frontend
- Verify Stripe signature using `STRIPE_WEBHOOK_SECRET`
- Forward to StripeService.handleWebhook()
- Persist subscription state changes to database

**Files:** New `frontend/app/api/stripe/webhook/route.ts`

#### 0.3 — Integrate NDBC Buoy Data for Real Wave Heights

**Problem:** WeatherAgent estimates wave height from wind speed using simplified Beaufort relationships. `NDBCBuoyService` exists in shared/ but is never called.

**Fix:**
- Import NDBCBuoyService into WeatherAgent
- After NOAA/OpenWeather fetch, query nearest NDBC buoy
- If buoy data available, use real significant wave height + period instead of estimate
- Mark data source in response (estimated vs observed)

**Files:** `agents/weather/src/WeatherAgent.ts`, `shared/src/services/NDBCBuoyService.ts`

---

### Tier 1: Core Value (Makes Helmwise Actually Useful)

#### 1.1 — Nautical Chart Layer (OpenSeaMap + NOAA ENCs)

**Problem:** The map shows streets and parks. Sailors need depth contours, buoys, lights, and hazards.

**Approach:**
- Add OpenSeaMap tile overlay (`tiles.openseamap.org/seamark/{z}/{x}/{y}.png`) — free, immediate
- Add NOAA RNC raster chart tiles for US waters (free from NOAA)
- Layer selector: OSM base / OpenSeaMap overlay / NOAA charts
- Display depth soundings, navigation aids, restricted areas on map

**Files:** `frontend/app/components/map/RouteMap.tsx`, new `frontend/app/components/map/ChartLayers.tsx`

**Impact:** Transforms the map from "decoration" to "actually useful for navigation planning"

#### 1.2 — Offline-First Architecture

**Problem:** No service worker exists. Zero offline capability. Sailors lose connectivity routinely.

**Approach:**
- Implement service worker with Workbox
- Cache strategy: passage plans, recent weather, tidal predictions, chart tiles
- IndexedDB for structured data (passages, vessel profiles, waypoints)
- Background sync: queue passage plan requests when offline, execute on reconnect
- Offline indicator in header bar
- Pre-download passage data before departure (one-click)

**Files:** New `frontend/public/sw.ts`, update `frontend/app/layout.tsx`, new `frontend/app/lib/offline-store.ts`

**Impact:** Makes Helmwise usable offshore — the difference between "nice to have" and "I depend on this"

#### 1.3 — Weather Routing (Optimal Route Based on Wind/Current)

**Problem:** Routes are calculated purely by distance. A 200nm rhumb line through 40kt headwinds is not an "optimal" route.

**Approach — Phase 1 (Isochrone method):**
- Implement basic isochrone weather routing algorithm
- Use GFS wind forecasts (already available via NOAA)
- Simple polar model: speed = f(wind_speed, wind_angle) with basic boat-type defaults
- Generate 3 route options: shortest distance, fastest time, most comfortable
- Display all 3 on map with comparative stats

**Approach — Phase 2 (Polar integration):**
- Allow users to upload polar files (CSV/JSON)
- Community polars for common boat models (J/35, Beneteau 40, Hallberg-Rassy 43, etc.)
- AI-generated approximate polars from basic specs (LOA, displacement, sail area)
- Route optimization using actual boat performance data

**Files:** New `agents/route/src/weather-routing.ts`, new `shared/src/services/PolarService.ts`

**Impact:** This is what PredictWind charges $30/month for. It's the #1 feature sailors want.

#### 1.4 — Tidal Current Integration into Route Planning

**Problem:** ETA calculations ignore tidal currents. A 5-knot boat in a 3-knot adverse current makes 2 knots SOG. ETAs can be off by hours.

**Approach:**
- Query NOAA current predictions along route (already available via TidalAgent)
- Calculate set and drift at each waypoint
- Adjust SOG (speed over ground) based on current vector vs course
- Display current arrows on map along route
- Show "tidal gate" warnings where timing matters (harbor entries, narrow channels)
- Recommend departure time adjustments for favorable current

**Files:** `orchestrator/src/SimpleOrchestrator.ts`, `agents/route/src/index.ts`, new `agents/route/src/current-routing.ts`

#### 1.5 — Expand Restricted Areas Database

**Problem:** Only 3 hardcoded restricted areas (Cape Cod Naval, Stellwagen Bank, Boston TSS). The US alone has hundreds.

**Approach:**
- Import NOAA ENC restricted area polygons (available as GeoJSON)
- Include: military exercise areas, marine sanctuaries, traffic separation schemes, anchorage prohibited zones, cable/pipeline areas
- Store as PostGIS geometries (extension already enabled)
- Use ST_Intersects for route checking (replace basic bounds checking)
- Periodic refresh from authoritative sources
- International: import from UKHO, BSH (Germany), SHOM (France) for major cruising grounds

**Files:** `agents/safety/src/services/restricted-areas.ts`, new migration for PostGIS geometry column, data import scripts

---

### Tier 2: Competitive Differentiation (Why Choose Helmwise Over Others)

#### 2.1 — Multi-Model Weather Comparison

**Problem:** CLAUDE.md says "always present worst-case scenario when forecasts disagree" but WeatherAggregator is never used in the orchestrator. Sailors need to see when models disagree — that's when decisions are hardest.

**Approach:**
- Actually integrate WeatherAggregator into the planning pipeline
- Display NOAA vs OpenWeather side-by-side when they disagree
- Add ECMWF data (via OpenGribs or commercial API)
- Show confidence level prominently: "All models agree" vs "Models disagree on wind speed by 15kt"
- Color-code forecast reliability on map

**Files:** `orchestrator/src/SimpleOrchestrator.ts`, `orchestrator/src/services/weather-aggregator.ts`, `frontend/app/planner/page.tsx`

#### 2.2 — GRIB File Support

**Problem:** GRIB is the standard format for offshore weather data. Every serious passage planner supports it. Helmwise doesn't.

**Approach:**
- Server-side GRIB parsing (using `grib2json` or `eccodes` via WASM)
- Allow users to upload GRIB files (from Saildocs email, PredictWind, LuckGrib)
- Overlay wind/wave/pressure fields on the map
- Use GRIB data in weather routing calculations
- Auto-fetch GFS GRIB data for route area

**Files:** New `shared/src/services/GribService.ts`, new `frontend/app/components/map/WeatherOverlay.tsx` (upgrade existing placeholder)

#### 2.3 — Comprehensive Port/Anchorage Database

**Problem:** 20 hardcoded ports, US East Coast only. Useless for 95% of the world's sailors.

**Approach — Phase 1:**
- Integrate OpenSeaMap port/marina data (free, global coverage)
- Integrate ActiveCaptain-style community data (crowdsourced)
- Add Noonsite.com data for international ports (customs/visa requirements)

**Approach — Phase 2:**
- Allow users to submit port reports (facilities, conditions, hazards)
- Photo uploads for harbor entries
- Anchorage reports (holding quality, depth, protection from wind directions)
- Real-time "I'm here now" check-ins

**Files:** Replace `agents/port/src/data/portDatabase.ts` with API integration, new community submission system

#### 2.4 — Crew & Watch Management

**Problem:** No watch system tools. On multi-day passages, fatigue management is a safety issue.

**Approach:**
- Watch schedule generator based on crew count and passage duration
- Configurable patterns: 4-on/4-off, 3-on/6-off, Swedish watch, etc.
- Fatigue modeling: warn when any crew member gets <6hrs uninterrupted rest
- Crew qualification tracking (certifications, experience levels)
- Watch handover checklist with digital sign-off

**Files:** New `frontend/app/components/crew/WatchScheduler.tsx`, new `shared/src/types/crew.ts`

#### 2.5 — Fuel, Water & Provisioning Calculator

**Problem:** No resource planning. CLAUDE.md mandates 30% water/fuel reserves but nothing calculates consumption.

**Approach:**
- Fuel consumption: GPH at cruise speed * distance / speed + 30% reserve
- Water: 1.5 gal/person/day * crew * days + 50% safety margin
- Track tank levels during passage (user input)
- Warning when reserves drop below safety margin
- "Point of no return" calculation (can you make it back?)

**Files:** New `frontend/app/components/planning/ResourceCalculator.tsx`, new `agents/route/src/fuel-calculator.ts`

#### 2.6 — Pre-Departure Checklist System

**Problem:** Database tables for checklists exist (`checklist_templates`, `checklist_items`, `passage_checklists`) but no frontend implements them.

**Approach:**
- Template library: Coastal day sail, overnight passage, offshore passage, ocean crossing
- Customizable per vessel (auto-populate from vessel equipment inventory)
- Digital sign-off with timestamps
- Photo evidence upload (life raft inspection, safety gear layout)
- Block passage plan generation until critical items checked
- Safety equipment expiration tracking (flares, EPIRB battery, fire extinguisher)

**Files:** New `frontend/app/components/planning/Checklist.tsx`, wire up existing DB tables

---

### Tier 3: Market Leadership (What Nobody Else Does Well)

#### 3.1 — AI-Powered Passage Planning Assistant

**Problem:** Passage planning requires expertise. Most cruisers aren't professional navigators.

**Approach:**
- Natural language input: "I want to sail from Newport to Bermuda sometime in June, I have a week, and I don't want more than 25kt winds"
- AI generates multiple departure windows with trade-off explanations
- "Why this route?" — explain every waypoint choice, hazard avoided, weather window selected
- Plain-English safety briefing alongside technical data
- Progressive disclosure: simple summary first, drill into details on demand

**Files:** New `agents/planning-assistant/`, integrate with Claude API or similar

#### 3.2 — Satellite-Optimized Mode

**Problem:** Offshore sailors on Iridium GO! wait 30+ minutes for weather data. PredictWind solved this with server-side calculation and compressed delivery.

**Approach:**
- Server-side passage plan updates (recalculate in cloud, send compressed delta)
- Text-mode API: request weather update via SMS-sized message
- Compressed weather summary: "Wind NW 15-20 backing W 20-25 next 12hr, seas 6-8ft, next weather window 36hr"
- Priority data: only send what's changed since last update
- Iridium/InReach message integration for position reports

**Files:** New API endpoints optimized for bandwidth, compression middleware

#### 3.3 — AIS Integration & Traffic Awareness

**Problem:** No awareness of other vessels. Critical for route planning through busy shipping lanes.

**Approach:**
- Integrate MarineTraffic or AISHub API for vessel traffic density
- Show shipping lanes, TSS, and high-traffic areas on map
- Alert when route crosses major shipping lanes
- Suggest optimal crossing angles and timing
- Historical traffic patterns for route planning

**Files:** New `shared/src/services/AISService.ts`, map overlay component

#### 3.4 — Post-Passage Analysis & Learning

**Problem:** No way to compare planned vs actual. No institutional learning.

**Approach:**
- Import GPS track log after passage (GPX upload)
- Compare planned route vs actual track
- Compare forecast vs actual weather (from buoy/station data)
- Performance analysis: planned speed vs actual SOG
- Polar refinement: update boat polars based on actual performance
- Community insights: anonymized fleet performance data

**Files:** New `frontend/app/passages/[id]/analysis/`, new analysis service

#### 3.5 — Professional Delivery Skipper Mode

**Problem:** Delivery skippers are the highest-ARPU users. They need compliance documentation.

**Approach:**
- IMO A.893(21) compliant passage plan templates
- Auto-generated handover reports (PDF)
- 24/7 position tracking with scheduled reports to owner
- Risk assessment matrix with mitigation plans
- Insurance-ready documentation package
- Crew qualification verification
- Equipment checklist with photographic evidence
- Communication schedule with auto-alerts for missed check-ins

**Files:** New `frontend/app/professional/` section, PDF report templates

---

## Implementation Priority Matrix

| Enhancement | Effort | Impact | Priority |
|------------|--------|--------|----------|
| 0.1 Vessel draft | 1 day | SAFETY | **Immediate** |
| 0.2 Stripe webhooks | 1 day | BLOCKER | **Immediate** |
| 0.3 NDBC buoy data | 2 days | HIGH | **Immediate** |
| 1.1 Nautical charts | 2-3 days | CRITICAL | **Week 1** |
| 1.2 Offline mode | 1-2 weeks | CRITICAL | **Week 1-2** |
| 1.5 Restricted areas | 3-4 days | HIGH | **Week 2** |
| 1.4 Tidal current ETA | 3-4 days | HIGH | **Week 2** |
| 2.1 Multi-model weather | 3-4 days | HIGH | **Week 3** |
| 2.6 Checklist system | 3-4 days | HIGH | **Week 3** |
| 2.5 Fuel/water calc | 2-3 days | MEDIUM | **Week 3** |
| 1.3 Weather routing | 2-3 weeks | CRITICAL | **Week 3-5** |
| 2.3 Port database | 1-2 weeks | HIGH | **Week 4-5** |
| 2.4 Watch management | 1 week | MEDIUM | **Week 5** |
| 2.2 GRIB support | 1-2 weeks | HIGH | **Week 5-6** |
| 3.1 AI assistant | 2-3 weeks | HIGH | **Month 2** |
| 3.2 Satellite mode | 2-3 weeks | MEDIUM | **Month 2** |
| 3.3 AIS integration | 1-2 weeks | MEDIUM | **Month 2-3** |
| 3.4 Post-passage analysis | 1-2 weeks | MEDIUM | **Month 3** |
| 3.5 Professional mode | 3-4 weeks | HIGH (revenue) | **Month 3** |

---

## Competitive Positioning

### What Helmwise Does That Others Don't

| Feature | PredictWind | Navionics | Savvy Navvy | Windy | Helmwise |
|---------|-------------|-----------|-------------|-------|----------|
| Safety GO/NO-GO decision | - | - | - | - | **Yes** |
| Audit trail for safety decisions | - | - | - | - | **Yes** |
| Multi-agent parallel planning | - | - | - | - | **Yes** |
| Enriched safety failure fallback | - | - | - | - | **Yes** |
| Pre-departure checklists | - | - | - | - | **Planned** |
| Crew watch management | - | - | - | - | **Planned** |
| Weather routing | **Yes** | - | Basic | - | **Planned** |
| Nautical charts | - | **Yes** | **Yes** | - | **Planned** |
| GRIB files | **Yes** | - | - | **Yes** | **Planned** |
| Offline mode | **Yes** | **Yes** | **Yes** | - | **Planned** |
| AI planning assistant | - | - | - | - | **Planned** |
| Professional documentation | - | - | - | - | **Planned** |

### Helmwise's Unique Angle

**Safety-first, AI-powered passage planning.** Not trying to be a chartplotter (Navionics wins that). Not trying to be a weather visualization tool (Windy wins that). Helmwise is the **decision-support layer** that sits on top of everything else and tells you:

1. **Should I go?** (GO/CAUTION/NO-GO with reasons)
2. **When should I go?** (optimal departure window considering weather + tides + currents)
3. **What route should I take?** (weather-optimized, safety-verified)
4. **Am I prepared?** (checklists, resources, crew readiness)
5. **What could go wrong?** (hazards, weather changes, fuel range)

No other tool provides this comprehensive decision-support workflow with a full audit trail. That's the product.

---

## Key Metrics to Track

| Metric | Current | Target (6 mo) | Why It Matters |
|--------|---------|---------------|---------------|
| Passage plans generated/week | Unknown | 500+ | Core engagement |
| Free → Premium conversion | 0% | 5-8% | Revenue |
| GPX exports per plan | Unknown | >50% | Proves real utility |
| Offshore passages planned | 0 | 50+/week | Validates safety system |
| NPS (Net Promoter Score) | Unknown | >50 | Word-of-mouth in sailing community |
| Safety warning accuracy | Unknown | >95% | Life-safety requirement |
| Average plan generation time | ~2-3s | <3s | UX quality |

---

## Summary

Helmwise has strong foundations. The agent architecture, safety-first design, and real data integrations set it apart. But sailors won't use it in its current state because:

1. **They can't trust the map** (no nautical charts)
2. **They can't use it offshore** (no offline mode)
3. **They can't trust the wave data** (estimated, not measured)
4. **They can't optimize departure** (no weather routing)
5. **They can't plan outside NE US** (limited port/area coverage)

Fix those five things and you have a product that competes with PredictWind and Savvy Navvy while offering something neither does: a comprehensive safety decision-support system with full audit trail and AI-powered planning assistance.

The safety-first angle isn't just a feature — it's the entire product positioning. Every enhancement should reinforce the message: **Helmwise helps you make better decisions so you and your crew come home safe.**

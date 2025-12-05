# Phase 2: Frontend Testing Program - Detailed Plan

**Plan Date:** October 24, 2025  
**Prerequisites:** Phase 1 Backend Testing Complete ✅  
**Estimated Duration:** 3-4 weeks (25-30 hours)  
**Target Coverage:** 85%+ for critical frontend paths

---

## 🎯 MISSION

Validate all user-facing critical workflows and UI components to ensure excellent user experience and prevent frontend bugs in production.

**Priority Context:** Frontend testing is MEDIUM priority (backend more critical for maritime safety)

**Deployment Strategy:** Can deploy backend first, test frontend in parallel based on real usage patterns

---

## 📊 Frontend Current State

### Coverage Baseline

**Current Frontend Coverage:** 0%  
**Total Frontend Files:** ~135 files (components, pages, contexts, hooks, lib)  
**Lines of Code:** ~15,000 lines (estimated)  
**Existing Tests:** 4 E2E tests (auth, passage planning basics)

### Test Infrastructure Status

**✅ Already in Place:**
- Jest configuration (frontend/jest.config.js)
- Jest setup file (frontend/jest.setup.ts)
- React Testing Library installed
- E2E test framework (Playwright) configured
- 4 existing E2E tests

**🔴 Needs Addition:**
- Component testing patterns
- Mock implementations for external APIs
- Test fixtures for frontend data
- Custom testing utilities for Next.js App Router
- Mocking patterns for Supabase Auth
- Test database setup

---

## 🗂️ Frontend Module Inventory

### Critical User Flows (HIGHEST Priority)

**1. Authentication & Authorization**
- `app/login/page.tsx` - Login flow
- `app/signup/page.tsx` - Registration flow
- `app/reset-password/page.tsx` - Password reset
- `app/contexts/AuthContext.tsx` - Auth state management
- `app/lib/supabase-client.ts` - Supabase integration

**2. Passage Planning Core**
- `app/planner/page.tsx` - Main passage planning interface
- `app/passages/page.tsx` - Passage list/management
- `app/passages/[id]/page.tsx` - Individual passage view
- `app/components/PassagePlanner.tsx` - Core planner component

**3. Map Interactions**
- `app/components/Map.tsx` - Leaflet map integration
- `app/components/RouteEditor.tsx` - Route drawing
- `app/components/WaypointEditor.tsx` - Waypoint manipulation

### Supporting Flows (MEDIUM Priority)

**4. Dashboard & Navigation**
- `app/dashboard/page.tsx` - User dashboard
- `app/layout.tsx` - App layout and navigation
- `app/components/Sidebar.tsx` - Navigation sidebar

**5. Weather & Safety Display**
- `app/weather/page.tsx` - Weather overview
- `app/components/WeatherDisplay.tsx` - Weather data presentation
- `app/components/SafetyWarnings.tsx` - Safety alert display

**6. Settings & Profile**
- `app/components/VesselSettings.tsx` - Vessel configuration
- `app/components/UserSettings.tsx` - User preferences

### Administrative Features (LOW Priority)

**7. Admin Dashboard**
- `app/admin/page.tsx` - Admin overview
- `app/admin/users/page.tsx` - User management
- `app/admin/analytics/page.tsx` - Analytics dashboard

**8. Subscription & Billing**
- `app/pricing/page.tsx` - Pricing page
- `app/components/SubscriptionManager.tsx` - Subscription UI

---

## 📋 Phase 2 Testing Strategy

### Testing Pyramid for Frontend

**1. Unit Tests (40% of effort)**
- Individual components in isolation
- Hooks and utility functions
- State management logic
- Data transformation functions

**2. Integration Tests (40% of effort)**
- Component interactions
- API integration with mocked backends
- Context providers and consumers
- Form submissions and validation

**3. E2E Tests (20% of effort)**
- Critical user journeys
- Authentication flows
- Passage creation workflow
- Map interactions

### Testing Approach by Module Type

**Next.js Server Components:**
- Test rendering with mock data
- Test data fetching (mock fetch)
- Test error states
- Test loading states

**Client Components:**
- Test user interactions (clicks, inputs)
- Test state changes
- Test props rendering
- Test event handlers

**Contexts:**
- Test provider functionality
- Test consumer hooks
- Test state updates
- Test side effects

**Hooks:**
- Test hook behavior in isolation
- Test dependencies and effects
- Test return values
- Test edge cases

**API Routes:**
- Test request handling
- Test response formatting
- Test error handling
- Test authentication

---

## 🗓️ Week-by-Week Execution Plan

### Week 1: NOAA Fixes + Authentication (10 hours)

**Priority:** CRITICAL (auth is gate to all features)

**Day 1-2: Fix NOAA Test Types (3-4 hours)**

**Goal:** Complete Phase 1 backend testing to 100%

**Tasks:**
1. Read NOAAWeatherService.ts and NOAATidalService.ts interfaces (30 min)
2. Fix CurrentPrediction type in mock fixtures (1 hour)
   - Change `type: string` to `type: 'max_flood' | 'max_ebb' | 'slack'`
3. Fix Date vs number type mismatches (1 hour)
   - Use timestamps where service expects `number`
4. Add assertValidTimestamp helper (30 min)
5. Fix mock type assertions (30 min)
   - Replace UnknownFunction with proper types
6. Execute all 47 NOAA tests (30 min)
7. Generate coverage report (30 min)

**Success Criteria:**
- ✅ All 47 NOAA tests passing
- ✅ Clean TypeScript compilation
- ✅ NOAAWeatherService ~90%+ coverage
- ✅ NOAATidalService ~90%+ coverage

**Commit:** "Fix NOAA test types"

---

**Day 3-5: Authentication Flows (6 hours)**

**Test Files to Create:**
1. `app/__tests__/login.test.tsx` - Login flow tests
2. `app/__tests__/signup.test.tsx` - Registration tests
3. `app/__tests__/reset-password.test.tsx` - Password reset tests
4. `app/contexts/__tests__/AuthContext.test.tsx` - Auth context tests

**Test Scenarios (40 tests estimated):**

**Login Tests (10 tests):**
- ✅ Renders login form
- ✅ Validates email format
- ✅ Validates password requirements
- ✅ Successful login redirects to dashboard
- ✅ Failed login shows error message
- ✅ "Remember me" functionality
- ✅ Loading state during login
- ✅ Handles network errors
- ✅ Redirects to intended page after login
- ✅ Shows "forgot password" link

**Signup Tests (12 tests):**
- ✅ Renders signup form
- ✅ Validates email format
- ✅ Validates password strength (min 8 chars, uppercase, number)
- ✅ Validates password confirmation match
- ✅ Validates vessel name required
- ✅ Successful signup creates account
- ✅ Duplicate email shows error
- ✅ Email verification sent message
- ✅ Terms acceptance required
- ✅ Loading state during signup
- ✅ Handles API errors
- ✅ Links to login page

**Password Reset Tests (8 tests):**
- ✅ Renders password reset form
- ✅ Validates email format
- ✅ Sends reset email
- ✅ Shows success message
- ✅ Handles invalid email
- ✅ Token validation
- ✅ New password validation
- ✅ Reset confirmation

**AuthContext Tests (10 tests):**
- ✅ Provides auth state to children
- ✅ Login updates auth state
- ✅ Logout clears auth state
- ✅ Session persistence (localStorage)
- ✅ Token refresh logic
- ✅ User profile loading
- ✅ Auth state initialization
- ✅ Protected route enforcement
- ✅ Role-based access control
- ✅ Handles expired sessions

**Mocking Required:**
- Supabase Auth client
- JWT token handling
- Session storage
- API endpoints

**Success Criteria:**
- ✅ 40 auth tests passing
- ✅ Login/logout flow validated
- ✅ Registration flow validated
- ✅ Password reset validated
- ✅ Session management tested

**Estimated Coverage:**
- Login page: 85%+
- Signup page: 85%+
- Reset password page: 85%+
- AuthContext: 90%+

**Commit:** "Add authentication flow tests"

---

### Week 2: Passage Planning Workflow (10 hours)

**Priority:** CRITICAL (core product functionality)

**Test Files to Create:**
1. `app/__tests__/planner.test.tsx` - Main planner interface
2. `app/__tests__/passages.test.tsx` - Passage list management
3. `app/components/__tests__/PassagePlanner.test.tsx` - Planner component
4. `app/components/__tests__/PassageForm.test.tsx` - Passage creation form
5. `app/components/__tests__/WaypointList.test.tsx` - Waypoint management

**Test Scenarios (50 tests estimated):**

**Passage Creation Tests (15 tests):**
- ✅ Renders passage creation form
- ✅ Validates departure port required
- ✅ Validates destination port required
- ✅ Validates departure date
- ✅ Validates vessel draft format
- ✅ Creates passage successfully
- ✅ Shows loading state during creation
- ✅ Handles API errors
- ✅ Redirects after creation
- ✅ Saves to user's passage list
- ✅ Validates crew size (min 1)
- ✅ Validates crew experience level
- ✅ Optional notes field
- ✅ Vessel selection from profile
- ✅ Pre-fills defaults from profile

**Passage List Tests (10 tests):**
- ✅ Renders user's passages
- ✅ Shows passage summary cards
- ✅ Filters by status (planned/active/completed)
- ✅ Sorts by departure date
- ✅ Search by port names
- ✅ Empty state for no passages
- ✅ Delete passage confirmation
- ✅ Edit passage navigation
- ✅ Duplicate passage functionality
- ✅ Pagination for many passages

**Passage Detail Tests (10 tests):**
- ✅ Renders passage details
- ✅ Shows route on map
- ✅ Displays waypoints list
- ✅ Shows weather forecast
- ✅ Shows tidal information
- ✅ Displays safety warnings
- ✅ Shows distance and duration
- ✅ Export passage plan (PDF)
- ✅ Share passage (link)
- ✅ Edit passage details

**Waypoint Management Tests (10 tests):**
- ✅ Adds waypoint to route
- ✅ Edits waypoint coordinates
- ✅ Deletes waypoint
- ✅ Reorders waypoints
- ✅ Validates coordinate format
- ✅ Shows waypoint details
- ✅ Calculates distances between waypoints
- ✅ Shows ETA at each waypoint
- ✅ Handles minimum 2 waypoints
- ✅ Drag-and-drop reordering

**API Integration Tests (5 tests):**
- ✅ Fetches passage from backend
- ✅ Creates passage via API
- ✅ Updates passage via API
- ✅ Deletes passage via API
- ✅ Handles API errors gracefully

**Mocking Required:**
- Orchestrator API (/api/passage-planning/analyze)
- Passage CRUD API endpoints
- Weather data fetching
- Tidal data fetching
- Map library (Leaflet)

**Success Criteria:**
- ✅ 50 passage planning tests passing
- ✅ Create passage flow validated
- ✅ View passage flow validated
- ✅ Edit passage flow validated
- ✅ Waypoint management validated

**Estimated Coverage:**
- Planner page: 85%+
- Passages page: 85%+
- PassagePlanner component: 85%+
- Waypoint components: 85%+

**Commit:** "Add passage planning workflow tests"

---

### Week 3: Map & Weather/Safety Display (10 hours)

**Priority:** HIGH (critical visual components)

**Test Files to Create:**
1. `app/components/__tests__/Map.test.tsx` - Map component tests
2. `app/components/__tests__/RouteEditor.test.tsx` - Route drawing tests
3. `app/components/__tests__/WeatherDisplay.test.tsx` - Weather presentation
4. `app/components/__tests__/SafetyWarnings.test.tsx` - Safety alerts
5. `app/components/__tests__/TidalDisplay.test.tsx` - Tidal information

**Test Scenarios (45 tests estimated):**

**Map Component Tests (15 tests):**
- ✅ Renders map container
- ✅ Initializes Leaflet map
- ✅ Sets initial center and zoom
- ✅ Displays route polyline
- ✅ Displays waypoint markers
- ✅ Handles map click events
- ✅ Zoom controls work
- ✅ Pan and drag work
- ✅ Responsive sizing
- ✅ Layer controls (weather, tidal, hazards)
- ✅ Fullscreen mode
- ✅ Loading state
- ✅ Error state (map failed to load)
- ✅ Mobile touch gestures
- ✅ Cleanup on unmount

**Route Editor Tests (10 tests):**
- ✅ Click to add waypoint
- ✅ Drag waypoint to move
- ✅ Right-click to delete waypoint
- ✅ Shows distance measurements
- ✅ Shows bearing lines
- ✅ Snap to port/anchorage
- ✅ Undo/redo functionality
- ✅ Clear route confirmation
- ✅ Import route from file
- ✅ Export route to GPX

**Weather Display Tests (10 tests):**
- ✅ Renders weather forecast
- ✅ Shows wind speed and direction
- ✅ Shows wave height and period
- ✅ Shows visibility
- ✅ Shows precipitation
- ✅ Time series chart (48 hours)
- ✅ Weather icons
- ✅ Color-coded severity (green/yellow/red)
- ✅ Gale warning highlighting
- ✅ Loading/error states

**Safety Warnings Tests (7 tests):**
- ✅ Renders warning list
- ✅ Shows warning severity icons
- ✅ Groups by severity (critical/high/medium)
- ✅ Expands warning details
- ✅ Shows recommended actions
- ✅ Dismissible warnings (with confirmation)
- ✅ Empty state (no warnings)

**Tidal Display Tests (3 tests):**
- ✅ Renders tidal predictions
- ✅ Shows high/low tide times
- ✅ Shows tidal height chart

**Mocking Required:**
- Leaflet library
- Map tile providers
- Weather data API responses
- Tidal data API responses
- Safety warning data

**Success Criteria:**
- ✅ 45 map/weather/safety tests passing
- ✅ Map rendering validated
- ✅ Route editing validated
- ✅ Weather display validated
- ✅ Safety warnings validated

**Estimated Coverage:**
- Map component: 80%+
- RouteEditor: 85%+
- WeatherDisplay: 85%+
- SafetyWarnings: 90%+

**Commit:** "Add map and weather display tests"

---

### Week 4: Component Library + Dashboard (5 hours)

**Priority:** MEDIUM (supporting components)

**Test Files to Create:**
1. `app/components/__tests__/VesselSettings.test.tsx`
2. `app/components/__tests__/UserSettings.test.tsx`
3. `app/components/__tests__/Sidebar.test.tsx`
4. `app/__tests__/dashboard.test.tsx`
5. `app/hooks/__tests__/usePassages.test.tsx`
6. `app/hooks/__tests__/useWeather.test.tsx`

**Test Scenarios (30 tests estimated):**

**Settings Tests (10 tests):**
- ✅ Vessel settings form renders
- ✅ Updates vessel draft
- ✅ Updates vessel type
- ✅ Updates vessel dimensions
- ✅ Validates input formats
- ✅ Saves settings successfully
- ✅ User settings form renders
- ✅ Updates preferences
- ✅ Updates notification settings
- ✅ Saves user settings

**Navigation Tests (5 tests):**
- ✅ Sidebar renders correctly
- ✅ Active route highlighting
- ✅ Responsive mobile menu
- ✅ User profile dropdown
- ✅ Logout button

**Dashboard Tests (8 tests):**
- ✅ Dashboard renders
- ✅ Shows upcoming passages
- ✅ Shows recent passages
- ✅ Shows weather summary
- ✅ Shows notifications
- ✅ Quick actions (new passage, view weather)
- ✅ Loading state
- ✅ Empty state (new user)

**Custom Hooks Tests (7 tests):**
- ✅ usePassages hook returns passages
- ✅ usePassages createPassage mutation
- ✅ usePassages deletePassage mutation
- ✅ useWeather hook fetches weather
- ✅ useWeather hook caching
- ✅ useAuth hook returns auth state
- ✅ useVessel hook returns vessel data

**Success Criteria:**
- ✅ 30 component/hook tests passing
- ✅ Settings functionality validated
- ✅ Dashboard validated
- ✅ Custom hooks validated

**Estimated Coverage:**
- Settings components: 85%+
- Dashboard: 85%+
- Hooks: 90%+
- Sidebar: 85%+

**Commit:** "Add component and dashboard tests"

---

## 🧪 Testing Infrastructure Setup

### Jest Configuration

**File:** `frontend/jest.config.js`

**Enhancements Needed:**
```javascript
module.exports = {
  // ... existing config
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^leaflet$': '<rootDir>/__mocks__/leaflet.ts',
  },
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/__tests__/**',
    '!app/api/**', // API routes tested separately
  ],
  coverageThresholds: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
}
```

### Mock Implementations Required

**1. Supabase Client Mock**
**File:** `frontend/__mocks__/supabase-client.ts`
- Mock auth methods (signIn, signUp, signOut)
- Mock session management
- Mock user data

**2. Leaflet Mock**
**File:** `frontend/__mocks__/leaflet.ts`
- Mock map initialization
- Mock marker/polyline creation
- Mock event handlers

**3. Orchestrator API Mock**
**File:** `frontend/__mocks__/orchestrator-api.ts`
- Mock passage planning endpoint
- Mock weather/tidal data endpoints
- Mock safety analysis endpoint

**4. Next.js Router Mock**
**File:** `frontend/__mocks__/next-router.ts`
- Mock useRouter hook
- Mock navigation functions
- Mock query parameters

### Test Utilities

**File:** `frontend/test-utils.tsx`

**Custom render function:**
```typescript
export function renderWithProviders(
  ui: React.ReactElement,
  {
    authState = mockAuthState,
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider initialState={authState}>
        {children}
      </AuthProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
```

**Custom matchers:**
- `toBeVisibleOnScreen()` - Check viewport visibility
- `toHaveAccessibleName()` - ARIA label validation
- `toHaveBeenCalledWithUser()` - User action validation

---

## 📊 Coverage Targets by Module

### Critical Paths (90%+ Coverage Required)

**1. Authentication:**
- Login: 90%+
- Signup: 90%+
- Password reset: 85%+
- Auth context: 90%+

**2. Passage Planning:**
- Passage creation: 90%+
- Passage management: 85%+
- Waypoint editing: 85%+

### Important Paths (85%+ Coverage Required)

**3. Map & Visualization:**
- Map component: 80%+ (Leaflet integration complex)
- Route editor: 85%+
- Weather display: 85%+
- Safety warnings: 90%+

**4. Settings & Profile:**
- Vessel settings: 85%+
- User settings: 85%+
- Dashboard: 85%+

### Supporting Features (75%+ Coverage Required)

**5. Navigation:**
- Sidebar: 75%+
- Layout: 75%+

**6. Admin (if time permits):**
- Admin dashboard: 75%+
- User management: 75%+

---

## ⚠️ Testing Challenges & Solutions

### Challenge #1: Next.js App Router Testing

**Issue:** App Router uses Server Components by default, which are harder to test

**Solution:**
- Focus on testing Client Components ('use client')
- Mock Server Component data fetching
- Test Server Actions in isolation
- Use integration tests for Server Component flows

### Challenge #2: Leaflet Map Testing

**Issue:** Leaflet requires DOM and complex initialization

**Solution:**
- Create comprehensive Leaflet mock
- Test map interactions via events (not actual rendering)
- Focus on component logic, not Leaflet internals
- Use snapshot testing for map configuration

### Challenge #3: Supabase Auth Testing

**Issue:** Supabase client has complex auth flows

**Solution:**
- Mock entire Supabase client
- Create auth test utilities for common flows
- Mock session storage
- Test auth state changes, not Supabase internals

### Challenge #4: Async State Management

**Issue:** Many components use async data fetching

**Solution:**
- Use React Testing Library's waitFor utilities
- Mock API responses
- Test loading states explicitly
- Test error states explicitly

### Challenge #5: Responsive/Mobile Testing

**Issue:** UI behaves differently on mobile

**Solution:**
- Use matchMedia mocks for viewport sizes
- Test mobile-specific interactions (touch events)
- Test responsive component variations
- Focus on behavior, not exact layout

---

## 🎯 Success Criteria

### Phase 2 Completion Criteria

**Coverage Targets Met:**
- ✅ Frontend overall: 0% → 85%+
- ✅ Authentication: 90%+
- ✅ Passage planning: 85%+
- ✅ Map components: 80%+
- ✅ Settings/Dashboard: 85%+

**Test Execution:**
- ✅ All frontend tests passing (0 failures)
- ✅ No flaky tests
- ✅ Fast execution (<2 minutes full suite)
- ✅ Clean TypeScript compilation

**Quality Metrics:**
- ✅ ~185 new tests created (40 + 50 + 45 + 30 + 20 NOAA)
- ✅ All critical user flows validated
- ✅ E2E tests passing
- ✅ Component tests comprehensive

**Production Readiness:**
- ✅ Frontend ready for production deployment
- ✅ Full-stack comprehensively validated
- ✅ User experience bugs minimized
- ✅ Confidence in UI/UX quality

---

## 📅 Timeline Summary

**Week 1:** NOAA fixes (3-4h) + Authentication (6h) = **10 hours**
**Week 2:** Passage planning workflow = **10 hours**
**Week 3:** Map & Weather/Safety display = **10 hours**
**Week 4:** Components & Dashboard = **5 hours**

**Total:** **35 hours** over 4 weeks

**Deliverables:**
- 185+ new tests
- 85%+ frontend coverage
- Full-stack production-ready
- Backend + Frontend validated

---

## 💡 RECOMMENDATIONS

### If Backend Already Deployed

**Approach:** Test based on real usage patterns

**Priority Adjustments:**
1. Watch production analytics for most-used features
2. Test those features first
3. Fix bugs as users report them
4. Iterate based on real feedback

**Benefits:**
- Testing aligned with actual usage
- Higher ROI on testing effort
- User feedback validates priorities
- Faster response to real issues

### If Waiting to Deploy

**Approach:** Complete systematic testing program

**Priority Order:**
1. Week 1: NOAA + Auth (critical gate)
2. Week 2: Passage planning (core value)
3. Week 3: Map & Weather (key differentiator)
4. Week 4: Settings & Dashboard (polish)

**Benefits:**
- Complete confidence before launch
- No surprises in production
- Professional quality from day 1
- Full-stack validation

---

## 🏁 CONCLUSION

### Phase 2 Frontend Testing is Well-Defined

**Clear Plan:** 4 weeks, 35 hours, 185+ tests
**Realistic Targets:** 85%+ coverage for critical paths
**Proven Approach:** Systematic testing like Phase 1
**Flexible Execution:** Can adapt based on deployment decision

### Recommended Approach

**If Backend Deployed (RECOMMENDED):**
- Start with Week 1 (NOAA + Auth)
- Then adapt based on user feedback
- Iterate on most-used features
- Test as you enhance

**If Waiting for Full-Stack:**
- Execute full 4-week program
- Complete systematic validation
- Deploy with complete confidence
- Professional launch

---

**PHASE 2 PLAN: READY FOR EXECUTION** ✅

**Awaiting Decision:** Deploy backend now, or wait for full-stack testing?


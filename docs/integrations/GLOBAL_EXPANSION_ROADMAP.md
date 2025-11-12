# Helmwise Global Expansion Roadmap

## Current Coverage
- **Weather**: NOAA (US waters only)
- **Tides**: NOAA CO-OPS (US coasts only)
- **Ports**: 8 hardcoded (Boston, Portland, Newport, New York, Charleston, Miami, Nassau, Bermuda)
- **Navigation**: US-focused static database
- **Routing**: Global (coordinate-based math)

## Phase 1: Global Weather Integration (Required Services)

### OpenWeatherMap API
**Purpose**: Global weather coverage (fallback/secondary source)
**Coverage**: Worldwide, 200k+ locations
**Pricing**: 
- Free tier: 60 calls/minute, 1M calls/month
- Startup: $40/month (600 calls/minute)
- Developer: $120/month (3k calls/minute)
**Rate Limits**: 60/min (free), 600/min (paid)
**Cost Estimate**: $40-120/month depending on traffic
**Integration Effort**: 2-4 hours
**Status**: ⏸️ AWAITING PROVISIONING

**Required Steps:**
1. Sign up at https://openweathermap.org/api
2. Subscribe to "One Call API 3.0" plan
3. Obtain API key
4. Document rate limits and costs
5. Implement service with circuit breaker
6. Add to environment variables

### UK Met Office DataPoint API
**Purpose**: North Atlantic and European waters (high accuracy)
**Coverage**: UK, North Atlantic, Europe
**Pricing**: Free for non-commercial evaluation, £££ for commercial
**Status**: ⏸️ RESEARCH REQUIRED

### ECMWF API
**Purpose**: European waters, offshore Atlantic (most accurate)
**Coverage**: Global, specialized in Europe/Atlantic
**Pricing**: Commercial license required
**Status**: ⏸️ AWAITING COST ANALYSIS

## Phase 2: Global Tidal Predictions (Required Services)

### WorldTides API
**Purpose**: Global tidal predictions
**Coverage**: 50,000+ tidal stations worldwide
**Pricing**:
- Developer: $99/year (1,000 API calls/month)
- Standard: $299/year (10,000 calls/month)
- Professional: $999/year (100,000 calls/month)
**Rate Limits**: As per plan
**Cost Estimate**: $99-999/year
**Integration Effort**: 3-5 hours
**Status**: ⏸️ AWAITING PROVISIONING

**Required Steps:**
1. Sign up at https://www.worldtides.info
2. Subscribe to appropriate plan based on usage
3. Obtain API key
4. Test coverage in target regions
5. Implement with NOAA fallback for US waters

### Astronomical Tidal Calculations (Free Alternative)
**Purpose**: Backup when APIs unavailable
**Coverage**: Global (less accurate than API data)
**Pricing**: Free (calculation-based)
**Accuracy**: ±20% (acceptable for planning, not navigation)
**Integration Effort**: 8-12 hours
**Status**: ✅ CAN IMPLEMENT ANYTIME

## Phase 3: Global Port Database (Free Data Available)

### World Port Index (NGA)
**Source**: https://msi.nga.mil/Publications/WPI
**Coverage**: 28,000+ ports worldwide
**Format**: CSV/GeoJSON (free download)
**Pricing**: FREE (public domain)
**Data Quality**: Official, comprehensive
**Integration Effort**: 4-6 hours
**Status**: ✅ CAN IMPLEMENT NOW

**Implementation:**
1. Download WPI database
2. Parse and import to local database
3. Add search by coordinates
4. Include in Port Agent

### OpenSeaMap API
**Source**: https://www.openseamap.org
**Coverage**: Global marinas, anchorages, harbors
**Pricing**: FREE (OpenStreetMap-based)
**Data Quality**: Crowdsourced (variable)
**Integration Effort**: 3-4 hours
**Status**: ✅ CAN IMPLEMENT NOW

## Phase 4: Global Navigation Warnings

### NAVAREA Warnings
**Source**: IMO/IHO system
**Coverage**: 21 NAVAREAs (worldwide)
**Pricing**: FREE (maritime safety mandate)
**Access**: Via regional coordinators
**Integration Effort**: 6-8 hours per region
**Status**: ⏸️ RESEARCH REQUIRED

### GMDSS Safety Information
**Source**: Various national hydrographic offices
**Coverage**: Worldwide MSI (Maritime Safety Information)
**Pricing**: FREE (safety requirement)
**Status**: ⏸️ INTEGRATION DOCUMENTATION NEEDED

## Phase 5: Enhanced Ocean Routing

### Great Circle vs. Rhumb Line
**Status**: ✅ CAN IMPLEMENT NOW (no external service)
**Effort**: 2-3 hours

### Ocean Current Integration
**Source**: NOAA OSCAR (Ocean Surface Current Analysis)
**Coverage**: Global ocean currents
**Pricing**: FREE
**Integration**: 4-6 hours
**Status**: ✅ CAN IMPLEMENT NOW

### Weather Routing Optimization
**Source**: Internal algorithms using weather + current data
**Integration**: 12-16 hours
**Requires**: Global weather data first
**Status**: ⏸️ DEPENDS ON PHASE 1

## Implementation Priority Matrix

### Can Implement Immediately (No Cost):
1. ✅ World Port Index integration (FREE, 28k ports)
2. ✅ OpenSeaMap marinas (FREE)
3. ✅ Astronomical tide calculations (FREE, backup)
4. ✅ Ocean current data (NOAA OSCAR, FREE)
5. ✅ Great circle routing (math-based, FREE)

### Requires Service Provisioning (Paid APIs):
1. ⏸️ OpenWeatherMap ($40-120/month)
2. ⏸️ WorldTides API ($99-999/year)
3. ⏸️ ECMWF (enterprise pricing)
4. ⏸️ UK Met Office (commercial license)

### Requires Research/Documentation:
1. ⏸️ NAVAREA warning sources
2. ⏸️ Regional hydrographic offices
3. ⏸️ International maritime authorities

## Recommended Implementation Order

### Phase 1: Free Enhancements (Week 1)
- Integrate World Port Index (28k ports)
- Add OpenSeaMap marinas
- Implement astronomical tide calculations
- Add ocean current data
- Enhance routing algorithms

**Result**: Global port coverage, backup tides, ocean routing

### Phase 2: Service Provisioning (Week 2)
- Document OpenWeatherMap integration needs
- Get cost approval for $40/month
- Provision API key
- Implement global weather with fallback logic
- Test in non-US regions

**Result**: Worldwide weather coverage

### Phase 3: Tidal Expansion (Week 3)
- Document WorldTides integration needs
- Get cost approval for $299/year
- Provision API key
- Implement with NOAA + astronomical fallback
- Test globally

**Result**: Global tidal predictions

### Phase 4: Navigation Warnings (Week 4)
- Research NAVAREA data sources
- Document integration approach
- Implement free sources first
- Add regional warnings

**Result**: International navigation safety

## Cost Summary

### Immediate (Free):
- World Port Index: $0
- OpenSeaMap: $0
- Astronomical tides: $0
- Ocean currents: $0
- Enhanced routing: $0

### Tier 1 (Basic Global Coverage):
- OpenWeatherMap Startup: $40/month = $480/year
- WorldTides Developer: $99/year
- **Total**: ~$580/year

### Tier 2 (Professional Global Coverage):
- OpenWeatherMap Developer: $120/month = $1,440/year
- WorldTides Standard: $299/year
- ECMWF: TBD (likely $5k+/year)
- **Total**: ~$2,000-7,000/year

## Risk Mitigation

### Fail-Safe Approach:
1. Always maintain NOAA as primary for US waters
2. Use paid APIs as secondary/global sources
3. Implement free astronomical calculations as final fallback
4. Never fail silently - always warn user if data unavailable
5. Log all data source failures for monitoring

## Success Metrics

### Phase 1 Success:
- [ ] Can plan passages outside US waters
- [ ] Port database covers 28k+ worldwide ports
- [ ] Backup tide calculations available globally
- [ ] Ocean current data integrated

### Phase 2 Success:
- [ ] Weather data available for 200k+ locations
- [ ] Response time <5 seconds for any global location
- [ ] Graceful fallback if API fails

### Phase 3 Success:
- [ ] Tidal predictions for 50k+ stations worldwide
- [ ] Accuracy within ±10% of observations

## Security & Compliance

### API Key Management:
- Store all keys in environment variables (never in code)
- Use separate keys for dev/staging/production
- Monitor API usage and costs
- Set up alerts for quota limits
- Rotate keys quarterly

### Data Source Attribution:
- Clearly show data sources to users
- Include timestamps on all forecasts
- Provide confidence levels when available
- Link to original data sources

## Conclusion

Global expansion is achievable in phases:

**Now**: Implement free enhancements (ports, backup tides, routing)
**Week 2**: Add OpenWeatherMap ($40/month) for global weather
**Week 3**: Add WorldTides ($299/year) for global tides
**Ongoing**: Enhance with regional sources as needed

Estimated first-year cost for global coverage: **$600-2,000** depending on traffic.


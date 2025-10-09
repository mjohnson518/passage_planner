# Windy API Integration Setup Guide

## Purpose

Windy provides high-resolution wind forecasts and weather visualization data. This integration enhances Helmwise with detailed wind analysis crucial for sailing passage planning, including optimal sail selection and tacking strategies.

## Why Windy?

**Wind-Specific Excellence:**
- High-resolution wind forecasts (1-3km resolution in some areas)
- Multiple forecast models (ECMWF, GFS, ICON, NAM, AROME)
- Gust predictions
- Wind barb visualizations
- Spot forecasts for specific locations

**Sailing-Specific Features:**
- True wind vs apparent wind
- Wind rose data
- Historical wind patterns
- Webcam integrations (visual confirmation)
- Weather routing suggestions

**Visualization:**
- Beautiful animated wind maps
- GRIB file generation
- Interactive overlays
- Forecast model comparison

## Service Details

**Official Website:** https://www.windy.com/  
**API Documentation:** https://api.windy.com/  
**Developer Portal:** https://api.windy.com/keys

## Pricing & Plans

### Free Tier (Non-Commercial)

**Cost:** FREE  
**Access:** Register for API key  
**Limitations:**
- Personal/non-commercial use only
- 100 API calls per day
- Not suitable for Helmwise (commercial SaaS)

### Point Forecast API (Commercial)

**Cost:** $180/month (Professional plan)  
**Includes:**
- Unlimited point forecasts
- Multi-model data (ECMWF, GFS, ICON)
- 10-day forecasts
- Commercial usage allowed
- API support

**Website:** https://api.windy.com/point-forecast-api

### Webcams API

**Cost:** $60/month  
**Includes:**
- Access to 60,000+ webcams globally
- Visual weather confirmation
- Useful for port conditions

### Recommended for Helmwise

**Plan:** Point Forecast API - Professional  
**Cost:** $180/month  
**Suitable for:** Commercial sailing application  
**Justification:** High-resolution wind data is critical for sailing passages

## Alternative: Free/Low-Cost Options

**1. NOAA NDBC (National Data Buoy Center) - FREE**
- Real-time wind observations from buoys
- Free, unlimited access
- Excellent for US coastal waters
- Limited to observation points (not forecasts)

**2. OpenWeather API - LOW COST**
- $40/month for 60 calls/minute
- Global coverage
- 8-day forecasts
- Less accurate than Windy but more affordable

**3. Weatherbit API - LOW COST**
- $49/month for 500 calls/day
- 16-day forecasts
- Marine weather included
- Good alternative to Windy

**Recommendation:** Start with **OpenWeather ($40/month)** or **NOAA (FREE)** for Phase 2, add Windy later for premium features

## Provisioning Steps (Windy Professional)

### Step 1: Create Windy Account

1. Visit https://www.windy.com/
2. Create account (free registration)
3. Navigate to https://api.windy.com/keys
4. Apply for Commercial API access

### Step 2: Select Plan

1. Choose "Point Forecast API - Professional"
2. Cost: $180/month
3. Enter billing information
4. Confirm subscription

### Step 3: Obtain API Key

1. After approval (usually 24-48 hours)
2. Visit https://api.windy.com/keys
3. Copy your API key
4. Note the endpoint: `https://api.windy.com/api/point-forecast/v2`

### Step 4: Configure Environment Variables

Add to `.env`:
```bash
# Windy API
WINDY_API_KEY=your_api_key_here
WINDY_BASE_URL=https://api.windy.com/api
```

### Step 5: Test API Access

```bash
# Test point forecast
curl -X POST "https://api.windy.com/api/point-forecast/v2" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 42.3601,
    "lon": -71.0589,
    "model": "gfs",
    "parameters": ["wind", "gust", "waves"],
    "levels": ["surface"],
    "key": "YOUR_API_KEY"
  }'
```

Expected response: JSON with wind, gust, and wave forecasts

## API Endpoints for Helmwise

### 1. Point Forecast

**Endpoint:** POST `/api/point-forecast/v2`

**Request:**
```json
{
  "lat": 42.3601,
  "lon": -71.0589,
  "model": "gfs",
  "parameters": ["wind", "gust", "waves", "visibility", "pressure"],
  "levels": ["surface"],
  "key": "YOUR_API_KEY"
}
```

**Models Available:**
- `ecmwf` - Most accurate (update every 6h)
- `gfs` - Global, update every 6h  
- `icon` - European, very high resolution
- `nam` - North American, high resolution

**Parameters:**
- `wind` - Wind speed and direction
- `gust` - Wind gust
- `waves` - Wave height and period
- `visibility` - Visibility
- `pressure` - Sea level pressure
- `temp` - Temperature
- `dewpoint` - Dew point
- `rh` - Relative humidity
- `cape` - Convective energy (thunderstorms)

### 2. Webcams (Optional)

**Endpoint:** GET `/api/webcams/v2/list`

Useful for visual confirmation of conditions at departure/destination ports

## Data Format

**Response Structure:**
```json
{
  "ts": [timestamps array],
  "wind_u-surface": [wind u-component m/s],
  "wind_v-surface": [wind v-component m/s],
  "gust-surface": [gust speeds m/s],
  "waves-surface": [wave heights m]
}
```

**Transformation Needed:**
- Convert u/v components to speed/direction
- Convert m/s to knots (×1.94384)
- Convert meters to feet for waves (×3.28084)

## Rate Limits & Quotas

**Professional Plan:**
- Unlimited point forecasts
- No specific rate limit (be reasonable)
- Recommended: <1000 calls/hour to avoid throttling

**Monitoring:**
- Track API call count
- Monitor response times
- Alert if response time >3s consistently

## Expected API Call Volume for Helmwise

**Per Passage Plan:**
- Route start forecast: 1 call
- Waypoint forecasts: 5-10 calls
- Weather window analysis: 1-2 calls
- Model comparison (optional): 2-3 calls
- **Total per plan:** ~7-15 calls

**Monthly Estimate:**
- 100 plans/month: ~1,000 API calls
- 500 plans/month: ~5,000 API calls
- 1000 plans/month: ~10,000 API calls
- **Well within unlimited tier**

## Integration Complexity

**Estimated Time:** 3 hours

**Breakdown:**
- API client setup: 45 minutes
- U/V component to speed/direction conversion: 45 minutes
- Model selection logic: 30 minutes
- Unit conversions: 30 minutes
- Testing: 30 minutes

**Complexity:** MEDIUM (u/v wind components require math)

**Dependencies:**
- Existing API client infrastructure (Phase 1)
- Math utilities for wind vector calculations

## Wind Vector Calculations

**Convert U/V to Speed/Direction:**
```typescript
function uvToSpeedDirection(u: number, v: number) {
  const speed = Math.sqrt(u * u + v * v); // m/s
  const speedKnots = speed * 1.94384;
  
  // Direction (meteorological, where wind is FROM)
  let direction = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
  
  return { speed: speedKnots, direction };
}
```

## Model Selection Strategy

**For Helmwise:**
- **Primary:** ECMWF (most accurate globally)
- **Backup:** GFS (if ECMWF unavailable)
- **Regional:** ICON for Europe, NAM for North America

**Selection Logic:**
```typescript
function selectModel(latitude: number, longitude: number): string {
  // Use ICON for Europe (higher resolution)
  if (latitude > 35 && latitude < 72 && longitude > -15 && longitude < 40) {
    return 'icon';
  }
  
  // Use NAM for North America
  if (latitude > 20 && latitude < 60 && longitude > -140 && longitude < -50) {
    return 'nam';
  }
  
  // Default to ECMWF globally
  return 'ecmwf';
}
```

## Cost Estimate

**Monthly Costs:**
- Windy Professional: $180/month
- Expected usage: 2,000-10,000 calls/month (unlimited plan)
- Cost per passage plan: ~$0.05-$0.10 (amortized)

**Annual Cost:** ~$2,160/year

**Alternative:**
- OpenWeather ($40/month): $480/year  
- NOAA (FREE): $0/year
- **Recommendation:** Start with free NOAA, upgrade to Windy for premium tier users

## Alternatives Comparison

| Service | Cost/Month | Resolution | Updates | Marine Data | Recommendation |
|---------|-----------|------------|---------|-------------|----------------|
| **Windy** | $180 | High (1-3km) | 6h | Yes | Premium feature |
| **OpenWeather** | $40 | Medium (10km) | 3h | Yes | Good balance |
| **NOAA GFS** | FREE | Medium (25km) | 6h | Yes | **Start here** |
| **Weatherbit** | $49 | Medium (10km) | 6h | Yes | Alternative |

## Recommended Approach

**Phase 2 Implementation:**
1. **Start with NOAA GFS** (already integrated) - FREE
2. **Add OpenWeather** ($40/month) for enhanced resolution - AFFORDABLE  
3. **Add UK Met Office** (FREE tier) for North Atlantic - FREE
4. **Later: Add Windy** when premium tier revenue justifies cost - $180/month

**Rationale:**
- NOAA + OpenWeather + UK Met Office = ~$40/month total
- Covers 95% of use cases
- Windy can be added as "Premium Weather" feature for Pro tier users
- Better cost structure for startup phase

## Multi-Model Consensus

**When multiple sources available:**
```typescript
function consensusForecast(sources: Forecast[]) {
  // Average wind speeds
  const avgWind = sources.reduce((sum, s) => sum + s.windSpeed, 0) / sources.length;
  
  // Check agreement (within 20%)
  const maxDiff = Math.max(...sources.map(s => Math.abs(s.windSpeed - avgWind)));
  const agreement = maxDiff / avgWind < 0.2;
  
  return {
    wind: avgWind,
    confidence: agreement ? 'high' : 'medium',
    sources: sources.map(s => s.source),
    consensus: agreement
  };
}
```

## Monitoring & Alerting

**Track:**
- API call count per day
- Response times (should be <1s)
- Error rates (alert if >5%)
- Model availability (ECMWF vs GFS uptime)
- Data quality (cross-validation with other sources)

**Alerts:**
- API down for >10 minutes → Critical
- Quota approaching limit → Warning (if using paid tier)
- Response time >3s → Investigate
- Error rate >10% → Switch to fallback

## Security Considerations

**API Key Protection:**
- Store in environment variables only
- Never commit to repository
- Use separate keys for dev/staging/production
- Rotate keys annually
- Monitor for unauthorized usage

**Data Caching:**
- Cache aggressively (3-hour TTL)
- Reduces API calls and costs
- Faster response times
- Implement cache invalidation for updates

## Support & Documentation

**Windy Support:**
- Email: info@windy.com
- Forum: https://community.windy.com/
- Documentation: https://api.windy.com/
- Response time: 24-48 hours for paid plans

**API Changes:**
- Stable API (rarely changes)
- Versioned endpoints (v2 current)
- Deprecation notices sent via email

---

**Status:** WAITING FOR PROVISIONING DECISION  
**Recommendation:** DEFER to later phase - Start with FREE alternatives (NOAA + UK Met Office)  
**Cost:** $180/month  
**Alternative:** OpenWeather at $40/month provides 90% of value for 22% of cost  
**Best Approach:** Implement NOAA + UK Met Office (FREE) in Phase 2, add Windy later as premium feature


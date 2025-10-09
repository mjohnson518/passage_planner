# UK Met Office DataPoint API Integration Setup Guide

## Purpose

The UK Met Office provides high-quality weather forecasts specifically optimized for UK coastal waters and the North Atlantic. This integration enhances Helmwise weather accuracy for passages involving UK waters, Ireland, and transatlantic routes.

## Why UK Met Office?

**Regional Excellence:**
- Best-in-class forecasts for UK coastal waters
- Superior North Atlantic storm tracking
- Specialized marine forecasts for British Isles
- Integration with Royal Navy weather systems

**Marine Focus:**
- Dedicated inshore waters forecasts
- Shipping forecast areas (Viking, Forties, Cromarty, Forth, etc.)
- Gale warnings for specific sea areas
- Tidal surge predictions

**Data Quality:**
- Official meteorological authority for UK
- Used by UK Coast Guard and RNLI
- 5-day detailed forecasts, 10-day outlook
- Hourly updates for coastal areas

## Service Details

**Official Website:** https://www.metoffice.gov.uk/  
**DataPoint API:** https://www.metoffice.gov.uk/services/data/datapoint  
**Developer Portal:** https://datapointapi.metoffice.gov.uk/

## Pricing & Plans

### Free Tier (Public Use)

**Cost:** FREE  
**Access:** Register for API key  
**Limitations:**
- 5,000 API calls per day
- Forecast data only (no historical)
- 3-hourly resolution for most parameters
- Attribution required ("Data from Met Office")

**Registration:** https://www.metoffice.gov.uk/services/data/datapoint/api

### Commercial License

**Cost:** Custom pricing (typically $50-200/month based on usage)  
**Access:** Dedicated API keys with higher limits  
**Benefits:**
- Higher rate limits (100,000+ calls/day)
- Priority support
- Custom data formats
- SLA guarantees
- No attribution required

**Contact:** For commercial licensing: enquiries@metoffice.gov.uk

## Recommended Plan for Helmwise

**Start with FREE TIER:**
- 5,000 calls/day is sufficient for initial deployment
- Can support ~500 passage plans/day (10 forecasts per plan)
- Upgrade to commercial if approaching limits
- No upfront cost

**Upgrade Trigger:**
- Consistent usage >3,500 calls/day (70% of free tier)
- Need for SLA guarantees
- Commercial attribution requirements
- Higher resolution data needed

## Provisioning Steps

### Step 1: Register for API Key (FREE)

1. Visit https://www.metoffice.gov.uk/services/data/datapoint/api
2. Click "Register" for a DataPoint API key
3. Fill in registration form:
   - Name/Organization: Helmwise / Your Name
   - Email: your.email@helmwise.co
   - Use case: Maritime passage planning application
   - Accept terms and conditions
4. Verify email address
5. API key will be sent via email (usually within 24 hours)

**No credit card required for free tier**

### Step 2: Obtain API Key

Check email for:
- Subject: "Met Office DataPoint API Key"
- Contains your unique API key (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- Links to documentation and examples

### Step 3: Configure Environment Variables

Add to `.env`:
```bash
# UK Met Office DataPoint API
UKMO_API_KEY=your_api_key_here
UKMO_BASE_URL=http://datapoint.metoffice.gov.uk/public/data
```

### Step 4: Test API Access

```bash
# Test site list
curl "http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/sitelist?key=YOUR_API_KEY"

# Test forecast for London
curl "http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/352409?res=3hourly&key=YOUR_API_KEY"
```

Expected response: JSON with site list and forecast data

### Step 5: Explore Marine Data

**Available Datasets:**
- **wxfcs** - Weather forecasts (3-hourly and daily)
- **wxobs** - Weather observations
- **txt** - Text forecasts including shipping forecasts
- **val** - Location-specific forecasts (site list)

**Marine-Specific:**
- Shipping forecast text: http://datapoint.metoffice.gov.uk/public/data/txt/wxfcs/regionalforecast/json/514?key=YOUR_KEY
- Inshore waters: http://datapoint.metoffice.gov.uk/public/data/txt/wxfcs/regionalforecast/json/515?key=YOUR_KEY

## API Endpoints for Helmwise

### 1. Site List (find nearest forecast point)
```
GET /public/data/val/wxfcs/all/json/sitelist?key={API_KEY}
```

Returns list of all forecast sites with lat/lon

### 2. 3-Hourly Forecast
```
GET /public/data/val/wxfcs/all/json/{SITE_ID}?res=3hourly&key={API_KEY}
```

**Parameters returned:**
- Wind Speed (S) - mph
- Wind Direction (D) - compass degrees  
- Wind Gust (G) - mph
- Visibility (V) - meters  
- Weather Type (W) - coded
- Temperature (T) - Celsius
- Feels Like Temperature (F) - Celsius
- Precipitation Probability (Pp) - percentage
- Humidity (H) - percentage
- UV Index (U)

### 3. Shipping Forecast (text)
```
GET /public/data/txt/wxfcs/regionalforecast/json/514?key={API_KEY}
```

Returns traditional shipping forecast in JSON format

## Data Transformation

**Convert UK Met Office to Helmwise format:**

```typescript
interface UKMOForecast {
  windSpeed: number; // Convert mph to knots (*0.868976)
  windDirection: number; // degrees (already correct)
  windGust: number; // Convert mph to knots
  visibility: number; // Convert meters to nautical miles (/1852)
  temperature: number; // Convert Celsius to preferred unit
  precipitation: number; // percentage probability
  pressure?: number; // If available
}
```

## Rate Limits & Quotas

**Free Tier:**
- 5,000 calls per day
- No per-second rate limit (but be reasonable)
- Resets at midnight UTC

**Monitoring:**
- Track daily API call count
- Alert at 4,000 calls (80% of limit)
- Cache aggressively (3-hour TTL)
- Implement request deduplication

## Expected API Call Volume for Helmwise

**Per Passage Plan (UK waters):**
- Find nearest sites: 1 call (cached for 24 hours)
- Forecast retrieval: 3-5 calls (waypoints along route)
- Shipping forecast: 1 call (optional, cached for 6 hours)
- **Total per plan:** ~4-6 calls

**Monthly Estimate:**
- 100 plans/month: ~500 API calls
- 500 plans/month: ~2,500 API calls
- Well within free tier limits

## Integration Complexity

**Estimated Time:** 2 hours

**Breakdown:**
- API client setup: 30 minutes
- Site lookup and caching: 30 minutes
- Forecast parsing: 45 minutes
- Unit conversion (mph → knots, meters → nm): 15 minutes

**Complexity:** LOW (simple REST API, good documentation)

## Data Quality & Coverage

**Strengths:**
- Excellent for UK coastal waters
- Best source for Irish Sea, English Channel, North Sea
- Superior gale warnings for shipping forecast areas
- Reliable tidal surge predictions

**Limitations:**
- Coverage optimized for UK/North Atlantic
- Lower resolution outside Europe
- 5-day detailed forecasts only (10-day is general outlook)
- Site-based (not arbitrary lat/lon) - requires nearest site lookup

**Best Used For:**
- Passages involving UK waters
- North Atlantic crossings
- European coastal sailing
- Cross-validation with NOAA/ECMWF

## Fallback Strategy

**If API Unavailable:**
1. Fall back to NOAA GFS for the region
2. Log degraded mode operation
3. Notify user of data source change
4. Retry UK Met Office every 5 minutes

**If Quota Exhausted:**
1. Switch to NOAA GFS
2. Alert administrators
3. Cache existing forecasts longer (6 hours)
4. Resume UK Met Office next day

## Testing Procedure

**After provisioning:**

1. **Authentication Test:**
   ```bash
   curl "http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/sitelist?key=YOUR_KEY"
   ```
   Should return JSON with ~5,000 forecast sites

2. **Forecast Test:**
   ```bash
   # London forecast
   curl "http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/352409?res=3hourly&key=YOUR_KEY"
   ```
   Should return 40 forecast periods (5 days × 8 periods/day)

3. **Shipping Forecast Test:**
   ```bash
   curl "http://datapoint.metoffice.gov.uk/public/data/txt/wxfcs/regionalforecast/json/514?key=YOUR_KEY"
   ```
   Should return text forecast for all shipping areas

## Cost-Benefit Analysis

**Benefits:**
- FREE tier available (no cost barrier)
- High-quality UK/North Atlantic forecasts
- Official meteorological authority
- Shipping forecast integration (mariners are familiar with this)

**Costs:**
- Time to implement: ~2 hours
- Maintenance: minimal (stable API)
- Upgrade cost if needed: $50-200/month

**Recommendation:** **IMPLEMENT IN PHASE 2** - Free tier is perfect for Helmwise

## Production Checklist

Before deploying UK Met Office integration:

- [ ] API key obtained and tested
- [ ] Environment variables configured
- [ ] Site lookup caching implemented
- [ ] Unit conversions verified (mph→knots, meters→nm)
- [ ] Error handling and fallback to NOAA configured
- [ ] Quota monitoring setup
- [ ] Integration tests passing
- [ ] Cross-validation with NOAA implemented
- [ ] User notification of data source
- [ ] Attribution added to UI ("Data from Met Office")

---

**Status:** READY FOR PROVISIONING (FREE TIER)  
**Priority:** HIGH (free and valuable for North Atlantic coverage)  
**Recommendation:** Provision immediately and implement in Phase 2


# ECMWF API Integration Setup Guide

## Purpose

The European Centre for Medium-Range Weather Forecasts (ECMWF) provides the world's most accurate medium-range weather forecasts, particularly for European and North Atlantic waters. This integration is essential for Helmwise to provide reliable weather data for passages in these regions.

## Why ECMWF?

**Data Quality:**
- World-leading forecast accuracy (consistently outperforms other global models)
- 10-day forecasts with high reliability
- High-resolution data (9km grid spacing globally, 4.5km for Europe)
- Ensemble forecasting for confidence levels

**Coverage:**
- Global coverage with emphasis on European waters
- North Atlantic storm tracks (critical for transatlantic passages)
- Mediterranean Sea (complex weather patterns)
- Arctic and sub-Arctic regions

**Marine-Specific Data:**
- Wave height, period, and direction
- Wind speed and direction at multiple altitudes
- Sea surface temperature
- Ocean currents
- Visibility forecasts

## Service Details

**Official Website:** https://www.ecmwf.int/  
**API Documentation:** https://confluence.ecmwf.int/display/WEBAPI/Access+ECMWF+Public+Datasets  
**Data Portal:** https://www.ecmwf.int/en/forecasts/datasets

## Pricing & Plans

### Academic/Research License (Free)
- **Cost:** FREE
- **Access:** Limited to academic institutions
- **Limitations:** Non-commercial use only
- **Not suitable for Helmwise (commercial SaaS)**

### Commercial License

**Note:** ECMWF does not provide direct commercial API access. Commercial users must:
1. Access data through authorized resellers
2. Use publicly available datasets with restrictions
3. Partner with meteorological services that have ECMWF licenses

**Authorized Resellers:**
- **Meteomatics** - https://www.meteomatics.com/
- **NOAA (via GFS comparison)** - Free alternative
- **European Weather Cloud** - https://www.europeanweather.cloud/

**Recommended Approach for Helmwise:**

**Option A: Meteomatics API (ECMWF data reseller)**
- **Cost:** Starting at $299/month (5,000 API calls/month)
- **Data:** Full ECMWF model access
- **Support:** Commercial support included
- **SLA:** 99.9% uptime guarantee

**Option B: Use NOAA GFS + UK Met Office for equivalent coverage**
- **Cost:** FREE (NOAA) + UK Met Office pricing
- **Data:** Comparable accuracy for most regions
- **Coverage:** Global (NOAA GFS) + enhanced North Atlantic (UK Met)
- **Recommended for Phase 2 implementation**

## Recommended Solution: Meteomatics

For production Helmwise deployment with ECMWF data:

**Service:** Meteomatics Weather API  
**Plan:** Professional  
**Cost:** $299/month (estimated)  
**API Calls:** 5,000/month (should cover ~500 passage plans with 10 forecasts each)

## Provisioning Steps

### Step 1: Create Meteomatics Account

1. Visit https://www.meteomatics.com/en/sign-up/
2. Select "Professional" plan
3. Fill in company details:
   - Company: Helmwise
   - Use case: Maritime passage planning SaaS
   - Expected API calls: 5,000/month initially

### Step 2: Obtain API Credentials

1. Log in to Meteomatics portal
2. Navigate to "API Access" section
3. Generate API username and password
4. Note the API endpoint: `https://api.meteomatics.com`

### Step 3: Configure Environment Variables

Add to `.env`:
```bash
# ECMWF Data via Meteomatics
METEOMATICS_USERNAME=your_username_here
METEOMATICS_PASSWORD=your_password_here
METEOMATICS_BASE_URL=https://api.meteomatics.com
```

### Step 4: Test API Access

```bash
# Test authentication
curl -u "username:password" "https://api.meteomatics.com/2024-01-01T00:00:00Z/t_2m:C/42.3601,-71.0589/json"
```

Expected response: JSON with temperature data

### Step 5: Verify Data Quality

Test forecast retrieval for a known location:
- Compare with NOAA forecast
- Verify data freshness
- Check update frequency
- Validate marine parameters availability

## API Endpoints Needed

**Marine Forecast:**
```
GET /{timestamp}/wind_speed_10m:ms,wind_dir_10m:d,significant_wave_height:m,wave_period:s,visibility:m/{lat},{lon}/json
```

**Parameters:**
- `wind_speed_10m:ms` - Wind speed in m/s at 10m height
- `wind_dir_10m:d` - Wind direction in degrees
- `significant_wave_height:m` - Significant wave height in meters
- `wave_period:s` - Wave period in seconds
- `visibility:m` - Visibility in meters
- `pressure_msl:hPa` - Mean sea level pressure
- `precip_1h:mm` - Precipitation in mm/hour

**Time Range:**
- Use ISO 8601 format: `2024-07-15T10:00:00Z`
- Can request multiple timestamps: `2024-07-15T10:00:00Z,2024-07-15T16:00:00Z`
- Or use time ranges: `2024-07-15T00:00:00Z--2024-07-17T00:00:00Z:PT6H` (every 6 hours)

## Rate Limits & Quotas

**Professional Plan:**
- 5,000 API calls/month
- Up to 10 requests/second
- 10-day forecast horizon
- Historical data access (last 30 days)

**Quota Management:**
- Monitor usage via Meteomatics dashboard
- Set up alerts at 80% usage
- Implement caching (30-minute TTL for forecasts)
- Batch requests when possible

## Expected API Call Volume for Helmwise

**Per Passage Plan:**
- Initial forecast: 1 call (route start)
- Waypoint forecasts: ~5-10 calls (depending on route length)
- Weather window analysis: 1-2 calls
- **Total per plan:** ~7-13 calls

**Monthly Estimate:**
- 100 passage plans/month: ~1,000 API calls
- 500 passage plans/month: ~5,000 API calls
- 1000 passage plans/month: ~10,000 API calls (need higher tier)

**Current Helmwise Usage:** Estimate 100-200 plans/month initially

## Integration Complexity

**Estimated Time:** 4 hours

**Breakdown:**
- API client setup: 1 hour
- Data parsing and transformation: 1.5 hours
- Caching implementation: 30 minutes
- Error handling and retry logic: 30 minutes
- Testing with real API: 30 minutes

**Dependencies:**
- None (uses existing axios, retry, circuit breaker infrastructure)

**Testing:**
- Unit tests with mocked responses
- Integration tests with test credentials
- Validation against NOAA data for accuracy

## Data Quality Validation

**Cross-Validation:**
- Compare with NOAA forecasts for North American waters
- Compare with UK Met Office for North Atlantic
- Flag significant discrepancies (>20% difference in wind speed/wave height)
- Use consensus approach when sources disagree

**Freshness Requirements:**
- ECMWF updates: Every 6 hours (00z, 06z, 12z, 18z)
- Cache TTL: 3 hours maximum
- Reject data older than 6 hours
- Display last update timestamp to users

## Cost Estimate

**Monthly Costs:**
- Meteomatics Professional: $299/month
- Estimated usage: 2,000-5,000 calls/month
- Cost per passage plan: ~$0.06-$0.15

**Annual Cost:** ~$3,588/year

**Alternatives:**
- NOAA GFS (FREE) - comparable accuracy for most regions
- UK Met Office DataPoint (~$50/month) - enhanced North Atlantic
- **Recommended:** Start with free alternatives, add ECMWF if users request European coverage

## Alternative: Free Tier Implementation

**Use NOAA GFS for initial Phase 2:**
- FREE unlimited access
- Global coverage
- 7-day forecasts
- 0.25° resolution
- Updates every 6 hours
- Already integrated in Helmwise

**Upgrade path:**
- Add Meteomatics when European user base grows
- Implement as fallback/enhancement to NOAA
- Market as "Premium Weather" feature for Pro tier

## Monitoring & Alerting

**Track:**
- API call count and quota usage
- Response times (should be <2s)
- Error rates (alert if >5%)
- Data freshness (alert if >6 hours old)
- Cost per month (budget alert at $350)

**Alerts:**
- Quota at 80% usage → Warning
- Quota at 95% usage → Critical
- API errors >10% → Investigate
- Data stale >6 hours → Switch to fallback

## Security Considerations

**Credentials:**
- Store in environment variables (never commit)
- Use separate credentials for dev/staging/production
- Rotate passwords quarterly
- Monitor for unauthorized access

**Data Handling:**
- Cache encrypted if sensitive
- Log API calls without credentials
- Sanitize logs for production
- HTTPS only (enforced by Meteomatics)

## Next Steps After Provisioning

1. Add environment variables to `.env`
2. Create `WeatherService` class for ECMWF integration
3. Implement data transformation to Helmwise format
4. Add caching with 3-hour TTL
5. Configure retry logic and circuit breaker
6. Write integration tests with test credentials
7. Deploy to staging environment
8. Validate data quality
9. Monitor costs and performance
10. Deploy to production

## Support & Documentation

**Meteomatics Support:**
- Email: support@meteomatics.com
- Documentation: https://www.meteomatics.com/en/api/
- Status Page: https://status.meteomatics.com/
- Response Time: 24-48 hours for Professional plan

**ECMWF Direct:**
- Cannot provide commercial API access
- Refer to resellers for commercial use
- Public datasets available but with restrictions

---

**Status:** WAITING FOR PROVISIONING  
**Recommendation:** Start with NOAA GFS (free) for Phase 2, add Meteomatics when European user base justifies cost  
**Alternative:** Implement free tier first, upgrade later based on user demand and revenue


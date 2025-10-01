# TidalAgent Implementation Notes

## NOAA CO-OPS API Integration

### API Endpoint
Base URL: `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`

### Rate Limits
- **No API key required** for basic access
- **Rate Limit**: Not explicitly documented, but recommended to cache aggressively
- **Recommended Cache TTL**: 24 hours (tides are highly predictable)

### Products Available
1. **predictions** - Tide predictions (high/low tides)
2. **currents_predictions** - Tidal current predictions
3. **water_level** - Observed water levels
4. **stations** - Station metadata

### Date Format Requirements
- **Format**: `YYYYMMDD` (no separators)
- **Time Zone**: GMT/UTC recommended for consistency
- **Interval**: 
  - Tide predictions: `hilo` (high/low only)
  - Current predictions: `30` (30-minute intervals)

### Datum Options
- **MLLW** (Mean Lower Low Water) - Default, most common
- **MSL** (Mean Sea Level)
- **NAVD** (North American Vertical Datum)
- **STND** (Station Datum)

## Station Lookup

### Station Types
- **tide** - Tide prediction stations (~3,000+ stations)
- **current** - Current prediction stations (~500+ stations)
- **waterlevels** - Real-time water level stations

### Metadata Endpoint
URL: `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json`

### Station Search Radius
- Default: Unlimited (searches all stations)
- Implementation: Calculate distance to all stations and return nearest
- Typical nearest station: Within 50 nautical miles for US coastal waters

## Caching Strategy

### Cache Keys
```
tidal-agent:{md5-hash}  # General format

Examples:
tidal-agent:abc123...   # Tide predictions
tidal-agent:def456...   # Current predictions
tidal-agent:ghi789...   # Station lookup
```

### Cache TTLs
- **Tide Predictions**: 86400 seconds (24 hours)
- **Current Predictions**: 86400 seconds (24 hours)
- **Station Metadata**: 604800 seconds (1 week)
- **Water Levels**: No cache (real-time data)

## Distance Calculation

### Algorithm: Haversine Formula
Calculates great-circle distance between two points on a sphere.

### Earth Radius
- **3440.1 nautical miles** (used for marine navigation)
- Alternative: 6371 km or 3959 miles for land

### Accuracy
- ±0.5% for distances up to 1000 nm
- Sufficient for station lookup purposes

## Error Handling

### Common API Errors
1. **Invalid Station ID**: Station doesn't exist or doesn't support requested product
2. **Date Range Too Large**: Limit to 30-365 days depending on product
3. **No Data Available**: Station may be offline or not reporting
4. **Invalid Datum**: Datum not supported at this station

### Retry Strategy
- **Attempts**: 3 (inherited from BaseAgent)
- **Backoff**: Exponential (1s, 2s, 4s)
- **Health Reporting**: Marks agent as 'degraded' after repeated failures

## Data Quality Notes

### Tide Predictions
- Based on harmonic analysis of historical data
- Accuracy: ±10-15 minutes for timing
- Height accuracy: ±0.5 feet
- Valid up to 1 year in advance

### Current Predictions
- Based on tidal constituents
- Less reliable than tide predictions in some areas
- Affected by wind and weather conditions
- Should be combined with real-time observations when available

### Station Coverage
- **Excellent**: US East Coast, West Coast, Gulf of Mexico, Alaska
- **Good**: Hawaii, Caribbean, US Territories
- **Limited**: International waters (use interpolation or alternative sources)

## Production Considerations

### API Reliability
- NOAA CO-OPS API is generally very reliable (99%+ uptime)
- No SLA provided for free tier
- Consider fallback to cached data if API is unavailable

### Data Freshness
- Tide/current predictions: Updated annually
- Station metadata: Updated quarterly
- Water levels: Updated every 6 minutes

### Best Practices
1. Always cache station lookups (data is static)
2. Cache predictions for full 24 hours
3. Implement retry logic for transient failures
4. Monitor for station outages
5. Validate station IDs before making requests

## Example API Calls

### Tide Predictions
```
GET /api/prod/datagetter?
  begin_date=20240101&
  end_date=20240102&
  station=8443970&
  product=predictions&
  datum=MLLW&
  interval=hilo&
  units=english&
  time_zone=gmt&
  format=json
```

### Current Predictions
```
GET /api/prod/datagetter?
  begin_date=20240101&
  end_date=20240102&
  station=n04930&
  product=currents_predictions&
  units=english&
  time_zone=gmt&
  format=json&
  interval=30
```

### Water Levels (Real-time)
```
GET /api/prod/datagetter?
  begin_date=20240101&
  end_date=20240102&
  station=8443970&
  product=water_level&
  datum=MLLW&
  units=english&
  time_zone=gmt&
  format=json
```

### Station Metadata
```
GET /mdapi/prod/webapi/stations.json?
  type=waterlevels&
  units=english
```

## Testing Notes

### Mock Data
All tests use mocked axios responses to avoid hitting the actual API during testing.

### Test Coverage
- ✅ Initialization and health reporting
- ✅ Tool schema validation
- ✅ Station lookup and distance calculation
- ✅ Tide prediction parsing
- ✅ Current prediction type determination
- ✅ Water level data retrieval
- ✅ Error handling and retries
- ✅ Cache TTL verification

### Integration Testing
For full integration tests with real API:
1. Set valid NOAA_API_KEY environment variable (optional, no key required)
2. Use real station IDs (e.g., 8443970 for Boston)
3. Verify response formats match spec
4. Check cache is properly populated

## Future Enhancements

1. **Station Filtering**: Filter by station type, services, or capabilities
2. **Datum Conversion**: Convert between different datums
3. **Interpolation**: Calculate tide/current values for times between predictions
4. **Weather Integration**: Combine with wind data for more accurate current predictions
5. **Chart Datum**: Support chart datum conversions for navigation
6. **Anomaly Detection**: Alert when water levels differ significantly from predictions


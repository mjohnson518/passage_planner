# RouteAgent Implementation Notes

## Turf.js Integration

### Library Overview
- **Package**: `@turf/turf` v6.5.0
- **Purpose**: Battle-tested geospatial analysis for JavaScript
- **Capabilities**: Distance, bearing, routing, geometric operations
- **Units**: Supports nautical miles via `{units: 'nauticalmiles'}` (lowercase, no camel case)

### Key Functions Used
1. **`turf.distance()`** - Great circle distance calculation
2. **`turf.rhumbDistance()`** - Rhumb line distance (constant bearing)
3. **`turf.bearing()`** - Initial bearing between two points
4. **`turf.rhumbBearing()`** - Constant bearing for rhumb line
5. **`turf.destination()`** - Calculate destination point given origin, distance, bearing
6. **`turf.greatCircle()`** - Generate great circle route with intermediate points
7. **`turf.circle()`** - Create circular avoid areas
8. **`turf.polygon()`** - Create polygonal avoid areas
9. **`turf.booleanCrosses()`** - Check if line crosses polygon
10. **`turf.booleanWithin()`** - Check if line is within polygon

## Route Calculation Strategies

### 1. Great Circle Routes
- **Definition**: Shortest distance on a sphere
- **Use Case**: Long ocean passages (>100nm)
- **Characteristics**:
  - Curved path on Mercator projection
  - Constantly changing bearing
  - Requires intermediate waypoints for navigation
- **Implementation**: `turf.greatCircle()` with configurable intermediate points

### 2. Rhumb Line Routes
- **Definition**: Constant bearing route
- **Use Case**: Coastal navigation, short passages
- **Characteristics**:
  - Straight line on Mercator projection
  - Easy to follow with compass
  - Slightly longer than great circle on long routes
- **Implementation**: `turf.rhumbDistance()` and `turf.rhumbBearing()`

### Distance Comparison
- **Short routes (<100nm)**: Great circle ≈ Rhumb line (difference < 1nm)
- **Medium routes (100-500nm)**: Great circle saves 1-5nm
- **Long routes (>500nm)**: Great circle saves 5-20nm or more

## Waypoint Optimization

### Algorithm: Nearest Neighbor (TSP Approximation)
- **Complexity**: O(n²) where n = number of waypoints
- **Approach**: Greedy algorithm - always go to nearest unvisited waypoint
- **Accuracy**: 15-25% longer than optimal (good enough for sailing)
- **Benefits**: Fast, simple, deterministic

### Process
1. Start at departure point
2. Find nearest unvisited waypoint
3. Move to that waypoint
4. Repeat until all waypoints visited
5. Add destination point

### When to Use
- 3+ intermediate waypoints that can be reordered
- User doesn't care about visitation order
- Want to minimize total distance

### When NOT to Use
- Waypoints must be visited in specific order (e.g., fuel stops)
- User has time constraints at specific waypoints
- optimization !== 'distance'

## Avoid Area Routing

### Supported Area Types
1. **Circle**: Center point + radius in nautical miles
2. **Polygon**: Array of lat/lon coordinates forming closed shape

### Collision Detection
- Uses `turf.booleanCrosses()` to check if route intersects avoid area
- Also uses `turf.booleanWithin()` to check if route is contained in area
- Checks each route segment independently

### Detour Strategy
When route intersects avoid area:
1. Calculate midpoint of segment
2. Offset midpoint perpendicular to route by 10nm
3. Create two new segments: origin→offset, offset→destination
4. Recalculate distance and bearing for new segments

### Limitations
- Current detour is simplified (single 10nm offset)
- Production would need:
  - Multiple offset attempts (try both sides)
  - Variable offset distance based on area size
  - Path smoothing around complex areas
  - Consideration of multiple overlapping areas

## Caching Strategy

### Cache TTL: 1 Hour
- Routes can be recalculated frequently with different parameters
- Weather/tidal changes may require route adjustments
- User may iterate on preferences

### Cache Keys
```
route-agent:{md5-hash}
```

### What's Cached
- Complete route calculations (with all parameters)
- Great circle intermediate points
- Optimized waypoint orders

### What's NOT Cached
- Individual distance/bearing calculations (too granular)
- Detour calculations (depend on dynamic avoid areas)

## Distance and Bearing Calculations

### Bearing Normalization
All bearings normalized to 0-360° range:
```typescript
bearing = (bearing + 360) % 360
```

### Coordinate Order
- **Turf.js**: [longitude, latitude] (GeoJSON standard)
- **Our API**: {latitude, longitude} (common convention)
- **Conversion**: Always swap when creating Turf points

### Precision
- Distances accurate to ±0.1 nautical miles
- Bearings accurate to ±0.1 degrees
- Sufficient for marine navigation

## Performance Considerations

### Route Calculation Complexity
- **Simple route**: O(1) - single segment
- **n waypoints**: O(n) - n segments to calculate
- **Optimization**: O(n²) - nearest neighbor
- **Avoid areas**: O(n × m) where m = number of avoid areas

### Optimization Recommendations
1. Limit waypoints to <20 for real-time response
2. Cache optimized routes aggressively
3. Consider async calculation for complex routes
4. Pre-calculate common routes (e.g., harbor to harbor)

## Testing Notes

### Mock Strategy
- Mock Turf.js entirely to avoid ESM import issues
- Implement simplified Haversine for distance in mock
- Mock returns geometrically valid results
- Allows testing without Turf.js runtime dependency

### Test Coverage
- ✅ 24 passing tests
- ✅ Initialization and tool registration
- ✅ Route calculation (simple and complex)
- ✅ Rhumb line calculation
- ✅ Great circle calculation  
- ✅ Waypoint optimization (TSP approximation)
- ✅ Avoid area routing
- ✅ Distance/bearing normalization
- ✅ Edge cases (same start/end, empty waypoints)
- ✅ Error handling

### Integration Testing
For real Turf.js testing:
1. Run tests with actual Turf.js (not mocked)
2. Verify great circle is shorter than rhumb on long routes
3. Test avoid area collision detection
4. Verify bearing calculations match nautical charts

## Production Enhancements

### Route Optimization Improvements
1. **2-opt algorithm**: Iterative route improvement
2. **Genetic algorithm**: Better global optimum for many waypoints
3. **Time-based optimization**: Consider tides and currents
4. **Weather routing**: Route around storms

### Avoid Area Enhancements
1. **Buffer zones**: Add safety margin around avoid areas
2. **Smooth routing**: Use curves instead of sharp angles
3. **Multiple obstacles**: Handle overlapping/complex areas
4. **Dynamic avoidance**: Real-time updates from AIS, weather

### Advanced Features
1. **Tidal routing**: Optimize for favorable currents
2. **Weather routing**: Route around storms and headwinds
3. **Fuel optimization**: Minimize fuel consumption for powerboats
4. **Comfort routing**: Minimize beam seas and pitching
5. **Multi-day planning**: Identify safe overnight anchorages

## API Response Examples

### Simple Route
```json
{
  "waypoints": [
    { "latitude": 42.3601, "longitude": -71.0589, "name": "Boston" },
    { "latitude": 41.3559, "longitude": -72.0895, "name": "New London" }
  ],
  "segments": [{
    "from": { "latitude": 42.3601, "longitude": -71.0589 },
    "to": { "latitude": 41.3559, "longitude": -72.0895 },
    "distance": 87.3,
    "bearing": 205.4,
    "estimatedTime": 14.55
  }],
  "totalDistance": 87.3,
  "estimatedDuration": 14.55,
  "optimized": false
}
```

### Great Circle with Intermediate Points
```json
{
  "distance": 2850.5,
  "initial_bearing": 72.3,
  "type": "great_circle",
  "waypoints": [
    { "latitude": 40.0, "longitude": -75.0, "sequence": 0 },
    { "latitude": 41.2, "longitude": -72.8, "sequence": 1 },
    { "latitude": 42.4, "longitude": -70.6, "sequence": 2 },
    ...
  ],
  "from": { "latitude": 40.0, "longitude": -75.0 },
  "to": { "latitude": 50.0, "longitude": -60.0 }
}
```

## Error Scenarios

### Common Errors
1. **Invalid coordinates**: Lat/lon out of range (-90 to 90, -180 to 180)
2. **Same start/end**: Returns 0 distance, 0 duration
3. **No waypoints**: Falls back to direct route
4. **Impossible route**: Through land or restricted areas

### Error Handling
- Validate coordinates before calculation
- Return graceful fallbacks for edge cases
- Report degraded health on repeated failures
- Log warnings for suspicious routes (e.g., >10,000nm)

## Nautical Navigation Best Practices

### Waypoint Spacing
- **Coastal**: Every 10-50nm
- **Offshore**: Every 50-200nm
- **Ocean**: Every 200-500nm (great circle segments)

### Bearing Changes
- Avoid sharp turns (>90°) for sailing efficiency
- Plan tacks/jibes at optimal wind angles
- Account for set and drift from currents

### Safety Margins
- Stay 5-10nm from charted hazards
- Add buffer to avoid areas based on weather
- Plan alternative routes for contingencies

## Future Development

### Phase 3 Enhancements
1. **Chart data integration**: Avoid land, shallow water
2. **Restricted areas**: Military zones, shipping lanes
3. **Optimal tacking**: Calculate best VMG for upwind legs
4. **Multi-leg routes**: Break long passages into day sails

### Phase 4 Advanced Features
1. **Isochrone routing**: Time-optimal paths considering currents
2. **Weather routing**: Integrate GRIB data for dynamic routing
3. **Polar performance**: Use vessel polar diagrams
4. **Machine learning**: Learn from historical passage data


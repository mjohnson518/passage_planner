"use strict";
/**
 * Standard test coordinates for consistent testing across modules
 * Includes edge cases: polar, dateline, equator, antipodal points
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVALID_COORDINATES = exports.TEST_ROUTES = exports.TEST_COORDINATES = void 0;
exports.getTestCoordinatePair = getTestCoordinatePair;
exports.getTestRoute = getTestRoute;
/**
 * Standard test locations
 */
exports.TEST_COORDINATES = {
    // US East Coast
    BOSTON: {
        lat: 42.3601,
        lon: -71.0589,
        name: 'Boston, MA',
        description: 'Standard departure point for testing'
    },
    PORTLAND_ME: {
        lat: 43.6591,
        lon: -70.2568,
        name: 'Portland, ME',
        description: 'Common destination for short coastal routes'
    },
    BERMUDA: {
        lat: 32.3078,
        lon: -64.7505,
        name: 'Bermuda',
        description: 'Offshore destination, ~650nm from Boston'
    },
    NEWPORT_RI: {
        lat: 41.4901,
        lon: -71.3128,
        name: 'Newport, RI',
        description: 'Short coastal route from Boston'
    },
    // Edge case locations
    NORTH_POLE: {
        lat: 89.9,
        lon: 0,
        name: 'Near North Pole',
        description: 'Polar region navigation test'
    },
    SOUTH_POLE: {
        lat: -89.9,
        lon: 0,
        name: 'Near South Pole',
        description: 'Southern polar region test'
    },
    DATELINE_WEST: {
        lat: 20.0,
        lon: 179.5,
        name: 'West of Date Line',
        description: 'Test date line crossing'
    },
    DATELINE_EAST: {
        lat: 20.0,
        lon: -179.5,
        name: 'East of Date Line',
        description: 'Test date line crossing'
    },
    EQUATOR_WEST: {
        lat: 0,
        lon: -150.0,
        name: 'Equator (Western Pacific)',
        description: 'Equator crossing test'
    },
    EQUATOR_EAST: {
        lat: 0,
        lon: -90.0,
        name: 'Equator (Eastern Pacific)',
        description: 'Equator crossing test'
    },
    PRIME_MERIDIAN: {
        lat: 51.4778,
        lon: 0.0,
        name: 'Greenwich, UK',
        description: 'Prime meridian crossing'
    },
    // Antipodal point pairs (opposite sides of Earth)
    ANTIPODAL_A: {
        lat: 40.7128,
        lon: -74.0060,
        name: 'New York',
        description: 'Antipodal pair point A'
    },
    ANTIPODAL_B: {
        lat: -40.7128,
        lon: 105.9940,
        name: 'Indian Ocean (opposite NYC)',
        description: 'Antipodal pair point B'
    }
};
/**
 * Standard test routes with expected results
 */
exports.TEST_ROUTES = {
    BOSTON_TO_PORTLAND: {
        start: exports.TEST_COORDINATES.BOSTON,
        end: exports.TEST_COORDINATES.PORTLAND_ME,
        expectedDistance: 85.7, // nm
        expectedBearing: 24, // degrees true
        challenges: []
    },
    BOSTON_TO_BERMUDA: {
        start: exports.TEST_COORDINATES.BOSTON,
        end: exports.TEST_COORDINATES.BERMUDA,
        expectedDistance: 650, // nm (approximate)
        expectedBearing: 135, // degrees true (approximate)
        challenges: ['offshore', 'gulf_stream', 'weather_windows']
    },
    BOSTON_TO_NEWPORT: {
        start: exports.TEST_COORDINATES.BOSTON,
        end: exports.TEST_COORDINATES.NEWPORT_RI,
        expectedDistance: 50, // nm (approximate)
        expectedBearing: 195, // degrees true (approximate)
        challenges: ['coastal', 'traffic']
    },
    DATELINE_CROSSING: {
        start: exports.TEST_COORDINATES.DATELINE_WEST,
        end: exports.TEST_COORDINATES.DATELINE_EAST,
        expectedDistance: 60, // nm at 20° latitude (approximate)
        challenges: ['dateline', 'coordinate_normalization']
    },
    EQUATOR_CROSSING: {
        start: exports.TEST_COORDINATES.EQUATOR_WEST,
        end: exports.TEST_COORDINATES.EQUATOR_EAST,
        expectedDistance: 3600, // nm (60° × 60nm/degree)
        challenges: ['doldrums', 'light_winds', 'long_passage']
    },
    POLAR_ROUTE: {
        start: { lat: 70.0, lon: -150.0, name: 'Arctic', description: 'Arctic route start' },
        end: { lat: 75.0, lon: -140.0, name: 'Arctic North', description: 'Arctic route end' },
        challenges: ['polar_navigation', 'ice', 'limited_weather_data', 'meridian_convergence']
    },
    ANTIPODAL_ROUTE: {
        start: exports.TEST_COORDINATES.ANTIPODAL_A,
        end: exports.TEST_COORDINATES.ANTIPODAL_B,
        expectedDistance: 10800, // nm (half circumference of Earth, approximate)
        challenges: ['antipodal', 'multiple_great_circles', 'ambiguous_route']
    },
    SAME_LOCATION: {
        start: exports.TEST_COORDINATES.BOSTON,
        end: exports.TEST_COORDINATES.BOSTON,
        expectedDistance: 0,
        challenges: ['zero_distance', 'invalid_route']
    }
};
/**
 * Invalid coordinates for validation testing
 */
exports.INVALID_COORDINATES = {
    LAT_TOO_HIGH: { lat: 91, lon: 0, error: 'latitude too high' },
    LAT_TOO_LOW: { lat: -91, lon: 0, error: 'latitude too low' },
    LON_TOO_HIGH: { lat: 0, lon: 181, error: 'longitude too high' },
    LON_TOO_LOW: { lat: 0, lon: -181, error: 'longitude too low' },
    BOTH_INVALID: { lat: 100, lon: 200, error: 'both invalid' },
};
/**
 * Helper to get coordinate pair for testing
 */
function getTestCoordinatePair(name) {
    const coord = exports.TEST_COORDINATES[name];
    return {
        lat: coord.lat,
        lon: coord.lon
    };
}
/**
 * Helper to get test route
 */
function getTestRoute(name) {
    return exports.TEST_ROUTES[name];
}
//# sourceMappingURL=test-coordinates.js.map
"use strict";
/**
 * Mock Data Generator for Testing
 *
 * Generates realistic test data for passages, vessels, weather, and users.
 * Used for development, testing, and demos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockDataGenerator = exports.MockDataGenerator = void 0;
class MockDataGenerator {
    // Predefined realistic passages
    passages = [
        {
            name: 'Boston to Portland',
            departure: { port: 'Boston, MA', latitude: 42.3601, longitude: -71.0589, time: new Date() },
            destination: { port: 'Portland, ME', latitude: 43.6591, longitude: -70.2568 },
            distance_nm: 95,
            duration_hours: 16,
            waypoints: [
                { latitude: 42.3601, longitude: -71.0589, name: 'Boston Harbor' },
                { latitude: 42.8, longitude: -70.7, name: 'Cape Ann' },
                { latitude: 43.2, longitude: -70.5, name: 'Midpoint' },
                { latitude: 43.6591, longitude: -70.2568, name: 'Portland' },
            ],
        },
        {
            name: 'San Francisco to Los Angeles',
            departure: { port: 'San Francisco, CA', latitude: 37.8044, longitude: -122.4662, time: new Date() },
            destination: { port: 'Los Angeles, CA', latitude: 33.7175, longitude: -118.2828 },
            distance_nm: 382,
            duration_hours: 64,
            waypoints: [
                { latitude: 37.8044, longitude: -122.4662, name: 'Golden Gate' },
                { latitude: 36.95, longitude: -122.0, name: 'Monterey Bay' },
                { latitude: 35.17, longitude: -120.75, name: 'Point Conception' },
                { latitude: 34.01, longitude: -119.52, name: 'Santa Barbara' },
                { latitude: 33.7175, longitude: -118.2828, name: 'LA Harbor' },
            ],
        },
        {
            name: 'Miami to Key West',
            departure: { port: 'Miami, FL', latitude: 25.7617, longitude: -80.1918, time: new Date() },
            destination: { port: 'Key West, FL', latitude: 24.5551, longitude: -81.7800 },
            distance_nm: 110,
            duration_hours: 18,
            waypoints: [
                { latitude: 25.7617, longitude: -80.1918, name: 'Miami' },
                { latitude: 25.2, longitude: -80.5, name: 'Key Largo' },
                { latitude: 24.9, longitude: -81.0, name: 'Marathon' },
                { latitude: 24.5551, longitude: -81.7800, name: 'Key West' },
            ],
        },
    ];
    vessels = [
        {
            name: 'Sea Sprite',
            type: 'sailboat',
            length_feet: 35,
            draft_feet: 5.5,
            beam_feet: 11.5,
            cruise_speed_knots: 6,
            fuel_capacity_gallons: 30,
        },
        {
            name: 'Blue Horizon',
            type: 'catamaran',
            length_feet: 45,
            draft_feet: 3.5,
            beam_feet: 24,
            cruise_speed_knots: 7.5,
            fuel_capacity_gallons: 100,
        },
        {
            name: 'Ocean Explorer',
            type: 'motor_yacht',
            length_feet: 52,
            draft_feet: 4.5,
            beam_feet: 16,
            cruise_speed_knots: 18,
            fuel_capacity_gallons: 500,
        },
    ];
    weatherScenarios = [
        {
            name: 'Calm Conditions',
            conditions: {
                windSpeed: 8,
                windDirection: 180,
                waveHeight: 1.5,
                visibility: 10,
                description: 'Light winds, calm seas, excellent visibility',
            },
        },
        {
            name: 'Moderate Conditions',
            conditions: {
                windSpeed: 18,
                windDirection: 225,
                waveHeight: 4,
                visibility: 5,
                description: 'Moderate winds, choppy seas, good visibility',
            },
        },
        {
            name: 'Stormy Conditions',
            conditions: {
                windSpeed: 35,
                windDirection: 270,
                waveHeight: 10,
                visibility: 2,
                description: 'Gale force winds, rough seas, poor visibility',
            },
        },
        {
            name: 'Hurricane Warning',
            conditions: {
                windSpeed: 75,
                windDirection: 90,
                waveHeight: 18,
                visibility: 0.5,
                description: 'Hurricane conditions - DO NOT SAIL',
            },
        },
    ];
    /**
     * Generate a random passage
     */
    generatePassage(index) {
        const template = index !== undefined
            ? this.passages[index % this.passages.length]
            : this.passages[Math.floor(Math.random() * this.passages.length)];
        return {
            id: this.generateId(),
            ...template,
        };
    }
    /**
     * Generate multiple passages
     */
    generatePassages(count) {
        return Array.from({ length: count }, (_, i) => this.generatePassage(i));
    }
    /**
     * Generate a random vessel
     */
    generateVessel(index) {
        const template = index !== undefined
            ? this.vessels[index % this.vessels.length]
            : this.vessels[Math.floor(Math.random() * this.vessels.length)];
        return {
            id: this.generateId(),
            ...template,
        };
    }
    /**
     * Generate multiple vessels
     */
    generateVessels(count) {
        return Array.from({ length: count }, (_, i) => this.generateVessel(i));
    }
    /**
     * Generate weather scenario
     */
    generateWeatherScenario(index) {
        return index !== undefined
            ? this.weatherScenarios[index % this.weatherScenarios.length]
            : this.weatherScenarios[Math.floor(Math.random() * this.weatherScenarios.length)];
    }
    /**
     * Generate test user
     */
    generateUser(tier = 'free') {
        const id = this.generateId();
        const email = `test_${id.substr(0, 8)}@helmwise.test`;
        return {
            id,
            email,
            subscription_tier: tier,
            created_at: new Date(),
        };
    }
    /**
     * Generate safety scenario
     */
    generateSafetyScenario(type) {
        const scenarios = {
            shallow_water: {
                type: 'shallow_water',
                location: { latitude: 24.5, longitude: -81.7 }, // Florida Keys
                charted_depth: 8,
                vessel_draft: 6.5,
                tidal_height: -0.5,
                expected_warning: true,
                severity: 'high',
            },
            restricted_area: {
                type: 'restricted_area',
                waypoints: [
                    { latitude: 42.3, longitude: -70.3 }, // Near Stellwagen Bank Sanctuary
                    { latitude: 42.5, longitude: -70.1 },
                ],
                expected_warning: true,
                area_name: 'Stellwagen Bank National Marine Sanctuary',
            },
            severe_weather: {
                type: 'severe_weather',
                location: { latitude: 25.0, longitude: -80.0 },
                wind_speed: 40,
                wave_height: 12,
                expected_warning: true,
                recommendation: 'seek_shelter',
            },
        };
        return scenarios[type];
    }
    /**
     * Generate UUID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get all predefined passages
     */
    getAllPassageTemplates() {
        return [...this.passages];
    }
    /**
     * Get all predefined vessels
     */
    getAllVesselTemplates() {
        return [...this.vessels];
    }
    /**
     * Get all weather scenarios
     */
    getAllWeatherScenarios() {
        return [...this.weatherScenarios];
    }
}
exports.MockDataGenerator = MockDataGenerator;
// Export singleton instance
exports.mockDataGenerator = new MockDataGenerator();
//# sourceMappingURL=mock-data-generator.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafetyService = void 0;
class SafetyService {
    logger;
    chartService;
    portService;
    weatherService;
    // Emergency frequencies by region
    EMERGENCY_CHANNELS = {
        international: {
            distress: 16,
            safety: 70,
            digital_selective_calling: 70
        },
        usa: {
            coast_guard: 16,
            coast_guard_working: 22,
            marine_operator: 26
        }
    };
    constructor(chartService, portService, weatherService, logger) {
        this.chartService = chartService;
        this.portService = portService;
        this.weatherService = weatherService;
        this.logger = logger;
    }
    /**
     * Perform comprehensive safety check for a route
     */
    async performSafetyCheck(waypoints, vesselDetails, departureTime) {
        const hazards = [];
        const warnings = [];
        const recommendations = [];
        try {
            // Check route for navigation hazards
            const routeValidation = await this.chartService.validateRoute(waypoints, vesselDetails.draft);
            // Convert navigation hazards to safety hazards
            routeValidation.hazards.forEach(hazard => {
                hazards.push({
                    type: 'navigation',
                    severity: this.assessHazardSeverity(hazard, vesselDetails),
                    location: hazard.position,
                    description: `${hazard.type}: ${hazard.name || 'unnamed'}`,
                    avoidanceRadius: 0.5 // 0.5 nm safety margin
                });
            });
            // Add route warnings
            routeValidation.warnings.forEach(warning => {
                warnings.push({
                    type: 'navigation',
                    message: warning,
                    source: 'OpenSeaMap'
                });
            });
            // Check weather hazards along route
            const weatherHazards = await this.checkWeatherHazards(waypoints, departureTime);
            hazards.push(...weatherHazards.hazards);
            warnings.push(...weatherHazards.warnings);
            // Get emergency contacts for the region
            const emergencyContacts = await this.getEmergencyContacts(waypoints);
            // Find nearest safe harbors along route
            const safeHarbors = await this.findSafeHarborsAlongRoute(waypoints, vesselDetails.draft);
            // Calculate safety score
            const safetyScore = this.calculateSafetyScore(hazards, warnings);
            // Generate recommendations
            if (hazards.length > 0) {
                recommendations.push('Review identified hazards and plan alternative routes if necessary');
            }
            if (warnings.some(w => w.type === 'weather')) {
                recommendations.push('Monitor weather conditions closely and be prepared to delay departure');
            }
            if (safeHarbors.length < 3) {
                recommendations.push('Limited safe harbors along route - ensure adequate fuel and supplies');
            }
            // Always include safety equipment check
            recommendations.push('Ensure all safety equipment is aboard and functional');
            recommendations.push('File a float plan with a trusted contact');
            return {
                safe: safetyScore >= 70 && !hazards.some(h => h.severity === 'extreme'),
                score: safetyScore,
                hazards,
                warnings,
                recommendations,
                emergencyContacts,
                nearestSafeHarbors: safeHarbors
            };
        }
        catch (error) {
            this.logger.error({ error }, 'Safety check failed');
            return {
                safe: false,
                score: 0,
                hazards: [{
                        type: 'collision',
                        severity: 'high',
                        description: 'Unable to complete safety check - proceed with caution'
                    }],
                warnings: [{
                        type: 'system',
                        message: 'Safety check system error - manual verification required',
                        source: 'SafetyService'
                    }],
                recommendations: ['Manually verify route safety before departure'],
                emergencyContacts: this.getDefaultEmergencyContacts(),
                nearestSafeHarbors: []
            };
        }
    }
    /**
     * Create Man Overboard (MOB) waypoint and search pattern
     */
    createMOBWaypoint(currentPosition, currentSpeed, // knots
    currentBearing, // degrees
    windSpeed, windDirection) {
        // Calculate drift based on wind (simplified)
        let driftSpeed = 0;
        let driftDirection = 0;
        if (windSpeed && windDirection) {
            // Rule of thumb: person drifts at 2-3% of wind speed
            driftSpeed = windSpeed * 0.025;
            driftDirection = windDirection;
        }
        return {
            position: currentPosition,
            time: new Date(),
            currentSpeed: driftSpeed,
            currentDirection: driftDirection,
            searchPattern: currentSpeed > 5 ? 'expanding_square' : 'sector'
        };
    }
    /**
     * Generate search pattern for MOB
     */
    generateMOBSearchPattern(mobWaypoint, vesselSpeed) {
        const pattern = [];
        const startPos = mobWaypoint.position;
        // Calculate drift since MOB
        const timeSinceMOB = (new Date().getTime() - mobWaypoint.time.getTime()) / (1000 * 60 * 60); // hours
        const driftDistance = (mobWaypoint.currentSpeed || 0) * timeSinceMOB;
        // Adjust start position for drift
        const driftedPos = this.calculateNewPosition(startPos, mobWaypoint.currentDirection || 0, driftDistance);
        if (mobWaypoint.searchPattern === 'expanding_square') {
            // Generate expanding square pattern
            let legLength = 0.1; // Start with 0.1 nm legs
            const legIncrement = 0.1;
            let bearing = 0;
            let currentPos = driftedPos;
            for (let i = 0; i < 20; i++) {
                // Calculate next waypoint
                currentPos = this.calculateNewPosition(currentPos, bearing, legLength);
                pattern.push(currentPos);
                // Turn 90 degrees
                bearing = (bearing + 90) % 360;
                // Increase leg length every 2 legs
                if (i % 2 === 1) {
                    legLength += legIncrement;
                }
            }
        }
        else {
            // Sector search pattern
            const sectorAngle = 120; // degrees
            const legLength = 0.5; // nm
            for (let angle = -sectorAngle / 2; angle <= sectorAngle / 2; angle += 30) {
                const bearing = (mobWaypoint.currentDirection || 0) + angle;
                const waypoint = this.calculateNewPosition(driftedPos, bearing, legLength);
                pattern.push(waypoint);
                pattern.push(driftedPos); // Return to center
            }
        }
        return pattern;
    }
    /**
     * Get emergency contacts for a region
     */
    async getEmergencyContacts(waypoints) {
        // For now, return US Coast Guard contacts
        // In production, would determine region and return appropriate contacts
        const contacts = [
            {
                name: 'US Coast Guard',
                type: 'coast_guard',
                vhfChannel: 16,
                phone: '+1-800-424-8802',
                coverage: 'US Waters'
            },
            {
                name: 'Coast Guard Sector',
                type: 'coast_guard',
                vhfChannel: 22,
                coverage: 'Local sector working frequency'
            },
            {
                name: 'Marine Emergency',
                type: 'medical',
                vhfChannel: 16,
                phone: '911',
                coverage: 'Near shore'
            }
        ];
        return contacts;
    }
    /**
     * Check weather hazards along route
     */
    async checkWeatherHazards(waypoints, departureTime) {
        const hazards = [];
        const warnings = [];
        try {
            // Check weather at key points along route
            const weatherChecks = Math.min(waypoints.length, 5);
            const checkIndices = Array.from({ length: weatherChecks }, (_, i) => Math.floor(i * (waypoints.length - 1) / (weatherChecks - 1)));
            for (const index of checkIndices) {
                const point = waypoints[index];
                const forecast = await this.weatherService.getMarineForecast(point.latitude, point.longitude, 3);
                // Check for severe weather warnings
                forecast.warnings.forEach(warning => {
                    if (warning.severity === 'extreme' || warning.severity === 'severe') {
                        hazards.push({
                            type: 'weather',
                            severity: warning.severity,
                            location: point,
                            description: warning.headline,
                            avoidanceRadius: 50 // 50nm for severe weather
                        });
                        warnings.push({
                            type: 'weather',
                            message: warning.description,
                            validFrom: warning.onset,
                            validUntil: warning.expires,
                            source: 'NOAA'
                        });
                    }
                });
            }
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to check weather hazards');
            warnings.push({
                type: 'weather',
                message: 'Unable to retrieve weather data - check manually',
                source: 'SafetyService'
            });
        }
        return { hazards, warnings };
    }
    /**
     * Find safe harbors along route
     */
    async findSafeHarborsAlongRoute(waypoints, vesselDraft) {
        const safeHarbors = [];
        const checkedPorts = new Set();
        try {
            // Check for safe harbors at intervals along route
            const checkInterval = Math.max(1, Math.floor(waypoints.length / 10));
            for (let i = 0; i < waypoints.length; i += checkInterval) {
                const point = waypoints[i];
                const nearbyPorts = await this.portService.searchPortsNearby(point.latitude, point.longitude, 50 // 50km radius
                );
                for (const port of nearbyPorts) {
                    if (checkedPorts.has(port.id))
                        continue;
                    checkedPorts.add(port.id);
                    const details = await this.portService.getPortDetails(port.id);
                    if (details &&
                        details.navigation.depth.harbor >= vesselDraft + 1 &&
                        details.navigation.depth.approach >= vesselDraft + 1) {
                        const distance = this.calculateDistance(point.latitude, point.longitude, port.position.latitude, port.position.longitude);
                        const bearing = this.calculateBearing(point.latitude, point.longitude, port.position.latitude, port.position.longitude);
                        safeHarbors.push({
                            portId: port.id,
                            name: port.name,
                            distance: distance * 0.539957, // Convert km to nm
                            bearing,
                            estimatedTimeToReach: (distance * 0.539957) / 5, // Assume 5 knots
                            facilities: this.summarizeFacilities(details.facilities)
                        });
                    }
                }
            }
            // Sort by distance and keep closest 5
            return safeHarbors
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 5);
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to find safe harbors');
            return [];
        }
    }
    /**
     * Assess hazard severity based on vessel characteristics
     */
    assessHazardSeverity(hazard, vesselDetails) {
        if (hazard.type === 'rock' || hazard.type === 'wreck') {
            if (hazard.depth !== undefined && hazard.depth < vesselDetails.draft) {
                return 'extreme';
            }
            return 'high';
        }
        if (hazard.type === 'restricted_area') {
            return 'high';
        }
        if (hazard.type === 'shoal') {
            if (hazard.depth !== undefined && hazard.depth < vesselDetails.draft + 2) {
                return 'high';
            }
            return 'medium';
        }
        return 'low';
    }
    /**
     * Calculate overall safety score
     */
    calculateSafetyScore(hazards, warnings) {
        let score = 100;
        // Deduct for hazards
        hazards.forEach(hazard => {
            switch (hazard.severity) {
                case 'extreme':
                    score -= 30;
                    break;
                case 'high':
                    score -= 20;
                    break;
                case 'medium':
                    score -= 10;
                    break;
                case 'low':
                    score -= 5;
                    break;
            }
        });
        // Deduct for warnings
        warnings.forEach(() => {
            score -= 5;
        });
        return Math.max(0, Math.min(100, score));
    }
    /**
     * Get default emergency contacts
     */
    getDefaultEmergencyContacts() {
        return [
            {
                name: 'International Distress',
                type: 'coast_guard',
                vhfChannel: 16,
                coverage: 'International'
            },
            {
                name: 'Digital Selective Calling',
                type: 'coast_guard',
                vhfChannel: 70,
                coverage: 'International DSC'
            }
        ];
    }
    /**
     * Summarize port facilities
     */
    summarizeFacilities(facilities) {
        const summary = [];
        if (facilities.fuel?.diesel)
            summary.push('Diesel');
        if (facilities.water)
            summary.push('Water');
        if (facilities.electricity?.available)
            summary.push('Shore Power');
        if (facilities.repairs?.mechanical)
            summary.push('Repairs');
        if (facilities.services?.customs)
            summary.push('Customs');
        return summary;
    }
    /**
     * Calculate new position given bearing and distance
     */
    calculateNewPosition(start, bearing, distance // nautical miles
    ) {
        const R = 3440.065; // Earth radius in nautical miles
        const lat1 = start.latitude * Math.PI / 180;
        const lon1 = start.longitude * Math.PI / 180;
        const brng = bearing * Math.PI / 180;
        const d = distance / R;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) +
            Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
        const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
        return {
            latitude: lat2 * 180 / Math.PI,
            longitude: lon2 * 180 / Math.PI
        };
    }
    /**
     * Calculate distance between two points in km
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    /**
     * Calculate bearing between two points
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }
}
exports.SafetyService = SafetyService;
//# sourceMappingURL=SafetyService.js.map
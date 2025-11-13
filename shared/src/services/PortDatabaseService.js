"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortDatabaseService = void 0;
const axios_1 = __importDefault(require("axios"));
class PortDatabaseService {
    logger;
    cache;
    // In production, this would connect to a real port database API
    // For now, using OpenStreetMap Overpass API for basic port data
    OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
    // Mock data source - in production would be replaced with real API
    PORT_DATA_API = process.env.PORT_DATA_API || '';
    constructor(cache, logger) {
        this.cache = cache;
        this.logger = logger;
    }
    /**
     * Search for ports near a location
     */
    async searchPortsNearby(latitude, longitude, radiusKm = 50, types) {
        const cacheKey = `ports:nearby:${latitude.toFixed(2)},${longitude.toFixed(2)}:${radiusKm}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            // Calculate bounds from radius
            const bounds = this.calculateBounds(latitude, longitude, radiusKm);
            // Query OpenStreetMap for harbors and marinas
            const query = `
        [out:json][timeout:25];
        (
          node["harbour"="yes"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          way["harbour"="yes"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["leisure"="marina"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          way["leisure"="marina"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["seamark:type"="harbour"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        );
        out body;
      `;
            const response = await axios_1.default.post(this.OVERPASS_URL, query, {
                headers: { 'Content-Type': 'text/plain' }
            });
            const ports = [];
            const seen = new Set();
            response.data.elements.forEach((element) => {
                const name = element.tags.name;
                if (!name || seen.has(name))
                    return;
                seen.add(name);
                const port = {
                    id: `osm-${element.type}-${element.id}`,
                    name,
                    type: this.determinePortType(element.tags),
                    position: {
                        latitude: element.lat || element.center?.lat,
                        longitude: element.lon || element.center?.lon
                    },
                    country: element.tags['addr:country'] || '',
                    region: element.tags['addr:state'] || element.tags['addr:province'],
                    timezone: 'UTC' // Would need timezone lookup service
                };
                // Filter by requested types
                if (!types || types.includes(port.type)) {
                    ports.push(port);
                }
            });
            // Sort by distance
            const sortedPorts = this.sortByDistance(ports, latitude, longitude);
            await this.cache.set(cacheKey, sortedPorts, 3600); // Cache for 1 hour
            return sortedPorts;
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to search ports');
            return [];
        }
    }
    /**
     * Get detailed port information
     */
    async getPortDetails(portId) {
        const cacheKey = `port:details:${portId}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            // In production, this would fetch from a comprehensive port database
            // For now, return mock data structure
            if (portId.startsWith('osm-')) {
                // Parse OpenStreetMap ID
                const [, type, id] = portId.split('-');
                // Query for more details
                const query = `
          [out:json];
          ${type}(${id});
          out body;
        `;
                const response = await axios_1.default.post(this.OVERPASS_URL, query, {
                    headers: { 'Content-Type': 'text/plain' }
                });
                if (response.data.elements.length === 0) {
                    return null;
                }
                const element = response.data.elements[0];
                const tags = element.tags;
                const portDetails = {
                    id: portId,
                    name: tags.name || 'Unknown Port',
                    type: this.determinePortType(tags),
                    position: {
                        latitude: element.lat || element.center?.lat,
                        longitude: element.lon || element.center?.lon
                    },
                    country: tags['addr:country'] || '',
                    timezone: 'UTC',
                    facilities: this.parseFacilities(tags),
                    contact: this.parseContact(tags),
                    navigation: this.parseNavigation(tags),
                    description: tags.description,
                    warnings: [],
                    lastUpdated: new Date()
                };
                await this.cache.set(cacheKey, portDetails, 86400); // Cache for 24 hours
                return portDetails;
            }
            // For non-OSM ports, would query actual port database
            return null;
        }
        catch (error) {
            this.logger.error({ error, portId }, 'Failed to get port details');
            return null;
        }
    }
    /**
     * Search ports by name
     */
    async searchPortsByName(query, country) {
        const cacheKey = `ports:search:${query}:${country || 'all'}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            // Query OpenStreetMap
            const osmQuery = `
        [out:json][timeout:25];
        (
          node["harbour"="yes"]["name"~"${query}",i];
          way["harbour"="yes"]["name"~"${query}",i];
          node["leisure"="marina"]["name"~"${query}",i];
          way["leisure"="marina"]["name"~"${query}",i];
        );
        out body;
      `;
            const response = await axios_1.default.post(this.OVERPASS_URL, osmQuery, {
                headers: { 'Content-Type': 'text/plain' }
            });
            const ports = [];
            const seen = new Set();
            response.data.elements.forEach((element) => {
                const name = element.tags.name;
                if (!name || seen.has(name))
                    return;
                // Filter by country if specified
                if (country && element.tags['addr:country'] !== country) {
                    return;
                }
                seen.add(name);
                ports.push({
                    id: `osm-${element.type}-${element.id}`,
                    name,
                    type: this.determinePortType(element.tags),
                    position: {
                        latitude: element.lat || element.center?.lat,
                        longitude: element.lon || element.center?.lon
                    },
                    country: element.tags['addr:country'] || '',
                    region: element.tags['addr:state'],
                    timezone: 'UTC'
                });
            });
            await this.cache.set(cacheKey, ports, 3600);
            return ports;
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to search ports by name');
            return [];
        }
    }
    /**
     * Get nearest safe harbor for emergency
     */
    async getNearestSafeHarbor(latitude, longitude, vesselDraft) {
        try {
            // Search for nearby ports
            const nearbyPorts = await this.searchPortsNearby(latitude, longitude, 100);
            // Filter for ports that can accommodate the vessel
            for (const port of nearbyPorts) {
                const details = await this.getPortDetails(port.id);
                if (details &&
                    details.navigation.depth.harbor >= vesselDraft + 1 && // 1m clearance
                    details.navigation.depth.approach >= vesselDraft + 1) {
                    return details;
                }
            }
            return null;
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to find nearest safe harbor');
            return null;
        }
    }
    /**
     * Determine port type from OSM tags
     */
    determinePortType(tags) {
        if (tags.leisure === 'marina')
            return 'marina';
        if (tags.harbour === 'yes') {
            if (tags.harbour_type === 'marina')
                return 'marina';
            if (tags.harbour_type === 'anchorage')
                return 'anchorage';
        }
        if (tags['seamark:type'] === 'anchorage')
            return 'anchorage';
        return 'harbor';
    }
    /**
     * Parse facilities from OSM tags
     */
    parseFacilities(tags) {
        return {
            fuel: {
                diesel: tags['fuel:diesel'] === 'yes',
                gasoline: tags['fuel:gasoline'] === 'yes',
                propane: tags['fuel:lpg'] === 'yes'
            },
            water: tags['drinking_water'] === 'yes' || tags['water'] === 'yes',
            electricity: {
                available: tags['power_supply'] === 'yes' || tags['electricity'] === 'yes',
                voltages: this.parseVoltages(tags['voltage']),
                frequency: tags['frequency'] ? parseInt(tags['frequency']) : undefined
            },
            repairs: {
                haul_out: tags['repair:haul_out'] === 'yes',
                travel_lift: tags['repair:travel_lift'] === 'yes',
                crane: tags['crane'] === 'yes',
                mechanical: tags['repair:mechanical'] === 'yes',
                electrical: tags['repair:electrical'] === 'yes',
                sail: tags['repair:sail'] === 'yes'
            },
            provisions: {
                groceries: tags['shop'] === 'yes' || tags['shop:convenience'] === 'yes',
                marine_supplies: tags['shop:ship_chandler'] === 'yes',
                ice: tags['ice'] === 'yes'
            },
            services: {
                laundry: tags['laundry'] === 'yes',
                showers: tags['shower'] === 'yes',
                wifi: tags['internet_access'] === 'wifi' || tags['wifi'] === 'yes',
                customs: tags['customs'] === 'yes',
                immigration: tags['immigration'] === 'yes'
            }
        };
    }
    /**
     * Parse contact information
     */
    parseContact(tags) {
        return {
            vhf_channel: tags['vhf'] ? parseInt(tags['vhf']) : undefined,
            phone: tags['phone'] || tags['contact:phone'],
            email: tags['email'] || tags['contact:email'],
            website: tags['website'] || tags['contact:website'],
            harbormaster: tags['operator']
        };
    }
    /**
     * Parse navigation information
     */
    parseNavigation(tags) {
        return {
            approach: tags['seamark:information'],
            depth: {
                approach: this.parseDepth(tags['depth:approach']),
                harbor: this.parseDepth(tags['depth']) || 5, // Default 5m if unknown
                alongside: this.parseDepth(tags['depth:alongside']) || 3
            },
            restrictions: tags['access'] === 'private' ? ['Private facility'] : []
        };
    }
    /**
     * Parse depth values
     */
    parseDepth(depthStr) {
        if (!depthStr)
            return 0;
        const match = depthStr.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
    }
    /**
     * Parse voltage values
     */
    parseVoltages(voltageStr) {
        if (!voltageStr)
            return undefined;
        return voltageStr.split(';').map(v => parseInt(v)).filter(v => !isNaN(v));
    }
    /**
     * Calculate bounds from center and radius
     */
    calculateBounds(lat, lon, radiusKm) {
        const latDelta = radiusKm / 111; // Rough approximation
        const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
        return {
            north: lat + latDelta,
            south: lat - latDelta,
            east: lon + lonDelta,
            west: lon - lonDelta
        };
    }
    /**
     * Sort ports by distance from a point
     */
    sortByDistance(ports, lat, lon) {
        return ports.sort((a, b) => {
            const distA = this.calculateDistance(lat, lon, a.position.latitude, a.position.longitude);
            const distB = this.calculateDistance(lat, lon, b.position.latitude, b.position.longitude);
            return distA - distB;
        });
    }
    /**
     * Calculate distance between two points
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRad(deg) {
        return deg * (Math.PI / 180);
    }
}
exports.PortDatabaseService = PortDatabaseService;
//# sourceMappingURL=PortDatabaseService.js.map
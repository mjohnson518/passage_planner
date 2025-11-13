"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureGate = void 0;
class FeatureGate {
    static LIMITS = {
        free: {
            passagesPerMonth: 2,
            apiCallsPerDay: 0,
            exportFormats: ['basic'],
            forecastDays: 3,
            agents: ['weather', 'tidal', 'basic_route'],
            support: 'community',
        },
        premium: {
            passagesPerMonth: -1, // unlimited
            apiCallsPerDay: 100,
            exportFormats: ['gpx', 'pdf', 'kml'],
            forecastDays: 7,
            agents: '*', // all agents
            support: 'email',
        },
        pro: {
            passagesPerMonth: -1,
            apiCallsPerDay: 1000,
            exportFormats: ['gpx', 'pdf', 'kml', 'api'],
            forecastDays: 10,
            agents: '*',
            support: 'priority',
            customAgents: true,
            fleetManagement: true,
        },
        enterprise: {
            passagesPerMonth: -1,
            apiCallsPerDay: -1,
            exportFormats: ['*'],
            forecastDays: 14,
            agents: '*',
            support: 'dedicated',
            customAgents: true,
            fleetManagement: true,
            whiteLabel: true,
            sla: true,
        },
    };
    static async canUseFeature(userId, feature, subscription) {
        const tier = subscription?.tier || 'free';
        const limits = this.LIMITS[tier];
        // Check specific features
        switch (feature) {
            case 'create_passage':
                if (limits.passagesPerMonth === -1)
                    return true;
                const usageThisMonth = await this.getMonthlyUsage(userId, 'passage_planned');
                return usageThisMonth < limits.passagesPerMonth;
            case 'api_access':
                return limits.apiCallsPerDay > 0;
            case 'export_gpx':
                return limits.exportFormats.includes('gpx') || limits.exportFormats.includes('*');
            case 'export_pdf':
                return limits.exportFormats.includes('pdf') || limits.exportFormats.includes('*');
            case 'export_kml':
                return limits.exportFormats.includes('kml') || limits.exportFormats.includes('*');
            case 'fleet_management':
                return limits.fleetManagement || false;
            case 'custom_agents':
                return limits.customAgents || false;
            case 'white_label':
                return limits.whiteLabel || false;
            default:
                return false;
        }
    }
    static async enforceRateLimit(userId, action, subscription) {
        const tier = subscription?.tier || 'free';
        const limits = this.LIMITS[tier];
        if (action === 'api_call') {
            const dailyLimit = limits.apiCallsPerDay;
            if (dailyLimit === -1)
                return { allowed: true };
            const todayUsage = await this.getDailyUsage(userId, 'api_call');
            const allowed = todayUsage < dailyLimit;
            return {
                allowed,
                remainingCalls: Math.max(0, dailyLimit - todayUsage),
                resetAt: this.getNextResetTime(),
            };
        }
        return { allowed: true };
    }
    static getLimits(tier) {
        return this.LIMITS[tier];
    }
    static canUseAgent(agentId, subscription) {
        const tier = subscription?.tier || 'free';
        const limits = this.LIMITS[tier];
        if (limits.agents === '*')
            return true;
        if (Array.isArray(limits.agents)) {
            return limits.agents.includes(agentId);
        }
        return false;
    }
    static getForecastDays(subscription) {
        const tier = subscription?.tier || 'free';
        return this.LIMITS[tier].forecastDays;
    }
    static async getMonthlyUsage(userId, action) {
        // This would query the database for usage metrics
        // For now, return a placeholder
        return 0;
    }
    static async getDailyUsage(userId, action) {
        // This would query the database for usage metrics
        // For now, return a placeholder
        return 0;
    }
    static getNextResetTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
    }
}
exports.FeatureGate = FeatureGate;
//# sourceMappingURL=FeatureGate.js.map
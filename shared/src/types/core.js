"use strict";
// shared/types/core.ts
// Core type definitions for the entire system
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyCreateSchema = exports.SignupSchema = exports.LoginSchema = exports.PassagePlanRequestSchema = exports.AgentRequestSchema = exports.CoordinateSchema = void 0;
const zod_1 = require("zod");
// ===== Validation Schemas =====
exports.CoordinateSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
});
exports.AgentRequestSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    timestamp: zod_1.z.date(),
    source: zod_1.z.string(),
    target: zod_1.z.string(),
    type: zod_1.z.enum(['tool', 'resource', 'prompt']),
    name: zod_1.z.string(),
    arguments: zod_1.z.record(zod_1.z.any()),
    timeout: zod_1.z.number().optional(),
    priority: zod_1.z.enum(['low', 'normal', 'high']).optional(),
});
exports.PassagePlanRequestSchema = zod_1.z.object({
    departure: zod_1.z.string(),
    destination: zod_1.z.string(),
    departureTime: zod_1.z.date(),
    boatType: zod_1.z.enum(['sailboat', 'powerboat', 'catamaran']).optional(),
    preferences: zod_1.z.object({
        avoidNightSailing: zod_1.z.boolean().optional(),
        maxWindSpeed: zod_1.z.number().optional(),
        maxWaveHeight: zod_1.z.number().optional(),
    }).optional(),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
exports.SignupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    displayName: zod_1.z.string().min(2).optional(),
    boatType: zod_1.z.string().optional(),
});
exports.ApiKeyCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    scopes: zod_1.z.array(zod_1.z.string()).optional(),
    expiresAt: zod_1.z.date().optional(),
});
//# sourceMappingURL=core.js.map
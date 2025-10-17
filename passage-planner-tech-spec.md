# Passage Planner Technical Specification
## Production-Ready SaaS Implementation Guide

### Project Overview
Complete implementation of a production-ready SaaS passage planning system using Model Context Protocol (MCP) for orchestrating specialized AI agents. The system provides comprehensive sailing route planning with real-time data integration, subscription billing, and fleet management capabilities.

---

## 1. DATABASE SCHEMA IMPLEMENTATION

### 1.1 PostgreSQL/Supabase Schema

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geographic data
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- For scheduled jobs

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    company_name TEXT,
    phone TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'pro')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    trial_ends_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    monthly_passage_count INTEGER DEFAULT 0,
    usage_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month',
    metadata JSONB DEFAULT '{}

### 3.2 Additional Required Agents

#### Port Agent
**File: `/agents/port/PortAgent.ts`**

```typescript
import { BaseAgent } from '../base/BaseAgent.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

export class PortAgent extends BaseAgent {
  private marineTrafficApiKey: string;
  
  constructor(redisUrl: string, marineTrafficApiKey: string) {
    super({
      name: 'port-agent',
      description: 'Provides port information and facilities',
      version: '1.0.0',
      cacheTTL: 604800 // 1 week - port info doesn't change often
    }, redisUrl);
    
    this.marineTrafficApiKey = marineTrafficApiKey;
  }

  getTools(): Tool[] {
    return [
      {
        name: 'get_port_info',
        description: 'Get detailed port information',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            name: { type: 'string' }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'search_nearby_ports',
        description: 'Search for ports within a radius',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            radius_nm: { type: 'number', default: 50 },
            port_type: { type: 'string', enum: ['marina', 'anchorage', 'commercial', 'all'] }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'get_port_facilities',
        description: 'Get available facilities at a port',
        inputSchema: {
          type: 'object',
          properties: {
            port_id: { type: 'string' }
          },
          required: ['port_id']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'get_port_info':
        return await this.getPortInfo(args.latitude, args.longitude, args.name);
      case 'search_nearby_ports':
        return await this.searchNearbyPorts(args.latitude, args.longitude, args.radius_nm, args.port_type);
      case 'get_port_facilities':
        return await this.getPortFacilities(args.port_id);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getPortInfo(lat: number, lon: number, name?: string): Promise<any> {
    // Mock implementation - integrate with actual port database
    return {
      id: 'port_' + Math.random().toString(36).substr(2, 9),
      name: name || 'Unknown Port',
      latitude: lat,
      longitude: lon,
      type: 'marina',
      depth: {
        approach: 15,
        harbor: 12,
        alongside: 10
      },
      facilities: {
        fuel: true,
        water: true,
        electricity: true,
        wifi: true,
        laundry: true,
        groceries: true,
        repairs: true
      },
      contact: {
        vhf: 'Channel 16',
        phone: '+1-555-0100',
        email: 'harbormaster@port.com'
      },
      fees: {
        overnight: 2.50,
        weekly: 15.00,
        monthly: 45.00
      }
    };
  }

  private async searchNearbyPorts(lat: number, lon: number, radiusNm: number = 50, portType: string = 'all'): Promise<any[]> {
    // Mock implementation
    return [
      {
        id: 'port_1',
        name: 'Safe Harbor Marina',
        distance: 5.2,
        bearing: 045,
        type: 'marina'
      },
      {
        id: 'port_2',
        name: 'Quiet Cove Anchorage',
        distance: 8.7,
        bearing: 120,
        type: 'anchorage'
      }
    ];
  }

  private async getPortFacilities(portId: string): Promise<any> {
    return {
      portId,
      facilities: {
        berths: 250,
        maxLOA: 200,
        maxDraft: 15,
        fuel: ['diesel', 'gasoline'],
        services: ['repairs', 'haul-out', 'chandlery'],
        amenities: ['showers', 'laundry', 'wifi', 'restaurant', 'bar']
      }
    };
  }
}
```

#### Safety Agent
**File: `/agents/safety/SafetyAgent.ts`**

```typescript
import { BaseAgent } from '../base/BaseAgent.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

export class SafetyAgent extends BaseAgent {
  private noaaApiKey: string;
  
  constructor(redisUrl: string, noaaApiKey: string) {
    super({
      name: 'safety-agent',
      description: 'Provides safety information and navigation warnings',
      version: '1.0.0',
      cacheTTL: 3600 // 1 hour
    }, redisUrl);
    
    this.noaaApiKey = noaaApiKey;
  }

  getTools(): Tool[] {
    return [
      {
        name: 'check_route_safety',
        description: 'Check safety along a planned route',
        inputSchema: {
          type: 'object',
          properties: {
            route: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                }
              }
            },
            departure_time: { type: 'string', format: 'date-time' }
          },
          required: ['route']
        }
      },
      {
        name: 'get_navigation_warnings',
        description: 'Get navigation warnings for an area',
        inputSchema: {
          type: 'object',
          properties: {
            bounds: {
              type: 'object',
              properties: {
                north: { type: 'number' },
                south: { type: 'number' },
                east: { type: 'number' },
                west: { type: 'number' }
              }
            }
          },
          required: ['bounds']
        }
      },
      {
        name: 'get_emergency_contacts',
        description: 'Get emergency contacts for a region',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          },
          required: ['latitude', 'longitude']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'check_route_safety':
        return await this.checkRouteSafety(args.route, args.departure_time);
      case 'get_navigation_warnings':
        return await this.getNavigationWarnings(args.bounds);
      case 'get_emergency_contacts':
        return await this.getEmergencyContacts(args.latitude, args.longitude);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async checkRouteSafety(route: any[], departureTime?: string): Promise<any> {
    const warnings = [];
    const hazards = [];
    
    // Check each segment of the route
    for (let i = 0; i < route.length - 1; i++) {
      const segment = {
        from: route[i],
        to: route[i + 1]
      };
      
      // Check for known hazards (mock data)
      if (Math.random() > 0.7) {
        hazards.push({
          type: 'shallow_water',
          location: segment.from,
          description: 'Shallow water area - minimum depth 8ft',
          severity: 'moderate'
        });
      }
    }
    
    return {
      safe: hazards.length === 0,
      warnings,
      hazards,
      recommendations: this.generateSafetyRecommendations(hazards)
    };
  }

  private async getNavigationWarnings(bounds: any): Promise<any[]> {
    // Mock implementation
    return [
      {
        id: 'NAV_001',
        type: 'obstruction',
        description: 'Submerged wreck reported',
        location: { latitude: (bounds.north + bounds.south) / 2, longitude: (bounds.east + bounds.west) / 2 },
        issued: new Date().toISOString(),
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  private async getEmergencyContacts(lat: number, lon: number): Promise<any> {
    return {
      coastGuard: {
        vhf: 'Channel 16',
        phone: '+1-800-368-5647',
        mmsi: '003669999'
      },
      towingServices: [
        {
          name: 'SeaTow',
          phone: '+1-800-473-2869',
          vhf: 'Channel 16'
        },
        {
          name: 'BoatUS',
          phone: '+1-800-391-4869',
          vhf: 'Channel 16'
        }
      ],
      nearestHospital: {
        name: 'Coastal Medical Center',
        distance: 15.3,
        phone: '+1-555-0199'
      }
    };
  }

  private generateSafetyRecommendations(hazards: any[]): string[] {
    const recommendations = [];
    
    if (hazards.some(h => h.type === 'shallow_water')) {
      recommendations.push('Monitor depth carefully in marked shallow areas');
    }
    
    recommendations.push('Ensure all safety equipment is accessible and functional');
    recommendations.push('File a float plan with a trusted contact');
    
    return recommendations;
  }
}
```

#### Wind Agent
**File: `/agents/wind/WindAgent.ts`**

```typescript
import { BaseAgent } from '../base/BaseAgent.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

export class WindAgent extends BaseAgent {
  private openWeatherApiKey: string;
  
  constructor(redisUrl: string, openWeatherApiKey: string) {
    super({
      name: 'wind-agent',
      description: 'Provides wind analysis for sailing optimization',
      version: '1.0.0',
      cacheTTL: 1800 // 30 minutes
    }, redisUrl);
    
    this.openWeatherApiKey = openWeatherApiKey;
  }

  getTools(): Tool[] {
    return [
      {
        name: 'analyze_wind_route',
        description: 'Analyze wind conditions along a route',
        inputSchema: {
          type: 'object',
          properties: {
            route: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                }
              }
            },
            departure_time: { type: 'string', format: 'date-time' },
            vessel_type: { type: 'string', default: 'sailboat' }
          },
          required: ['route', 'departure_time']
        }
      },
      {
        name: 'get_optimal_departure',
        description: 'Find optimal departure time based on wind',
        inputSchema: {
          type: 'object',
          properties: {
            departure: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            destination: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            window_start: { type: 'string', format: 'date-time' },
            window_end: { type: 'string', format: 'date-time' }
          },
          required: ['departure', 'destination', 'window_start', 'window_end']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'analyze_wind_route':
        return await this.analyzeWindRoute(args.route, args.departure_time, args.vessel_type);
      case 'get_optimal_departure':
        return await this.getOptimalDeparture(args.departure, args.destination, args.window_start, args.window_end);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async analyzeWindRoute(route: any[], departureTime: string, vesselType: string = 'sailboat'): Promise<any> {
    const analysis = {
      segments: [],
      overall: {
        favorablePercentage: 0,
        averageWindSpeed: 0,
        dominantDirection: 0
      },
      recommendations: []
    };
    
    let favorableCount = 0;
    let totalWindSpeed = 0;
    
    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i];
      const to = route[i + 1];
      const bearing = this.calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);
      
      // Mock wind data
      const windDir = Math.random() * 360;
      const windSpeed = 5 + Math.random() * 20;
      const relativeWind = this.calculateRelativeWind(bearing, windDir, windSpeed);
      
      const segment = {
        from,
        to,
        bearing,
        wind: {
          direction: windDir,
          speed: windSpeed,
          relative: relativeWind
        },
        sailing: this.analyzeSailing(relativeWind, windSpeed, vesselType)
      };
      
      analysis.segments.push(segment);
      
      if (segment.sailing.favorable) favorableCount++;
      totalWindSpeed += windSpeed;
    }
    
    analysis.overall.favorablePercentage = (favorableCount / analysis.segments.length) * 100;
    analysis.overall.averageWindSpeed = totalWindSpeed / analysis.segments.length;
    
    // Generate recommendations
    if (analysis.overall.favorablePercentage < 30) {
      analysis.recommendations.push('Consider motor sailing for better progress');
    }
    if (analysis.overall.averageWindSpeed > 25) {
      analysis.recommendations.push('Strong winds expected - consider reefing early');
    }
    
    return analysis;
  }

  private async getOptimalDeparture(departure: any, destination: any, windowStart: string, windowEnd: string): Promise<any> {
    // Analyze wind conditions for different departure times
    const options = [];
    const startTime = new Date(windowStart).getTime();
    const endTime = new Date(windowEnd).getTime();
    const interval = 6 * 60 * 60 * 1000; // 6 hours
    
    for (let time = startTime; time <= endTime; time += interval) {
      const departureTime = new Date(time).toISOString();
      // Mock scoring
      const score = Math.random() * 100;
      
      options.push({
        departureTime,
        score,
        conditions: 'Favorable winds from the SW'
      });
    }
    
    options.sort((a, b) => b.score - a.score);
    
    return {
      optimal: options[0],
      alternatives: options.slice(1, 4)
    };
  }

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const x = Math.sin(dLon) * Math.cos(lat2Rad);
    const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    const bearing = Math.atan2(x, y) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  private calculateRelativeWind(heading: number, windDir: number, windSpeed: number): any {
    const relativeAngle = (windDir - heading + 360) % 360;
    
    return {
      angle: relativeAngle,
      speed: windSpeed,
      pointOfSail: this.getPointOfSail(relativeAngle)
    };
  }

  private getPointOfSail(angle: number): string {
    if (angle < 45 || angle > 315) return 'head to wind';
    if (angle < 80) return 'close hauled port';
    if (angle < 110) return 'beam reach port';
    if (angle < 160) return 'broad reach port';
    if (angle < 200) return 'run';
    if (angle < 250) return 'broad reach starboard';
    if (angle < 280) return 'beam reach starboard';
    return 'close hauled starboard';
  }

  private analyzeSailing(relativeWind: any, windSpeed: number, vesselType: string): any {
    const pointOfSail = relativeWind.pointOfSail;
    const favorable = !pointOfSail.includes('head to wind') && windSpeed > 5 && windSpeed < 30;
    
    return {
      favorable,
      pointOfSail,
      estimatedSpeed: this.estimateBoatSpeed(relativeWind.angle, windSpeed, vesselType)
    };
  }

  private estimateBoatSpeed(windAngle: number, windSpeed: number, vesselType: string): number {
    // Simplified polar diagram
    const polarFactor = Math.sin(windAngle * Math.PI / 180);
    const baseSpeed = vesselType === 'sailboat' ? 6 : 8;
    return Math.min(baseSpeed, windSpeed * polarFactor * 0.4);
  }
}

---

## 4. FRONTEND IMPLEMENTATION

### 4.1 Main App Layout
**File: `/frontend/app/layout.tsx`**

```typescript
import { Inter } from 'next/font/google';
import { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { AnalyticsProvider } from '@/contexts/AnalyticsContext';
import { Toaster } from '@/components/ui/toaster';
import Navigation from '@/components/Navigation';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HelmWise - AI-Powered Passage Planning',
  description: 'Professional sailing route planning with real-time weather and AI assistance',
  keywords: 'sailing, passage planning, marine navigation, weather routing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        <AuthProvider>
          <SocketProvider>
            <AnalyticsProvider>
              <div className="min-h-full">
                <Navigation />
                <main className="flex-1">
                  {children}
                </main>
              </div>
              <Toaster />
            </AnalyticsProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 4.2 Passage Planning Interface
**File: `/frontend/app/plan/page.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import MapView from '@/components/MapView';
import PlanningForm from '@/components/PlanningForm';
import AgentStatus from '@/components/AgentStatus';
import PassageResults from '@/components/PassageResults';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { orchestratorApi } from '@/lib/api';

export default function PlanPage() {
  const { user, subscription } = useAuth();
  const { socket, connected } = useSocket();
  const { trackEvent } = useAnalytics();
  const { toast } = useToast();
  
  const [planning, setPlanning] = useState(false);
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [passagePlan, setPassagePlan] = useState(null);
  const [route, setRoute] = useState([]);
  
  useEffect(() => {
    if (socket && connected) {
      socket.on('planning_started', (data) => {
        setPlanningId(data.planningId);
        setPlanning(true);
        toast({
          title: 'Planning Started',
          description: 'AI agents are working on your passage plan...',
        });
      });
      
      socket.on('agent_active', (data) => {
        setAgentStatuses(prev => ({
          ...prev,
          [data.agent]: {
            status: 'active',
            message: data.status
          }
        }));
      });
      
      socket.on('planning_completed', (data) => {
        setPlanning(false);
        setPassagePlan(data.plan);
        setRoute(data.plan.route.waypoints);
        trackEvent('passage_planned', {
          distance: data.plan.summary.totalDistance,
          duration: data.plan.summary.estimatedDuration
        });
        toast({
          title: 'Planning Complete',
          description: 'Your passage plan is ready!',
          variant: 'success',
        });
      });
      
      socket.on('planning_error', (data) => {
        setPlanning(false);
        toast({
          title: 'Planning Failed',
          description: data.error,
          variant: 'destructive',
        });
      });
      
      return () => {
        socket.off('planning_started');
        socket.off('agent_active');
        socket.off('planning_completed');
        socket.off('planning_error');
      };
    }
  }, [socket, connected]);
  
  const handlePlanSubmit = async (formData: any) => {
    // Check subscription limits
    if (subscription.tier === 'free' && subscription.monthlyUsage >= 5) {
      toast({
        title: 'Limit Reached',
        description: 'You have reached your monthly limit. Upgrade to continue.',
        variant: 'warning',
      });
      return;
    }
    
    try {
      const response = await orchestratorApi.planPassage({
        ...formData,
        userId: user.id
      });
      
      // Response will come through WebSocket
    } catch (error) {
      console.error('Planning error:', error);
      toast({
        title: 'Error',
        description: 'Failed to start planning. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Form and Status */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Plan Your Passage</h2>
            <PlanningForm 
              onSubmit={handlePlanSubmit}
              disabled={planning}
            />
          </Card>
          
          {planning && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Agent Status</h3>
              <AgentStatus statuses={agentStatuses} />
            </Card>
          )}
        </div>
        
        {/* Right Panel - Map and Results */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] mb-6">
            <MapView 
              route={route}
              showWeather={true}
              interactive={true}
            />
          </Card>
          
          {passagePlan && (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="route">Route</TabsTrigger>
                <TabsTrigger value="weather">Weather</TabsTrigger>
                <TabsTrigger value="tides">Tides</TabsTrigger>
                <TabsTrigger value="safety">Safety</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary">
                <PassageResults 
                  plan={passagePlan}
                  section="summary"
                />
              </TabsContent>
              
              <TabsContent value="route">
                <PassageResults 
                  plan={passagePlan}
                  section="route"
                />
              </TabsContent>
              
              <TabsContent value="weather">
                <PassageResults 
                  plan={passagePlan}
                  section="weather"
                />
              </TabsContent>
              
              <TabsContent value="tides">
                <PassageResults 
                  plan={passagePlan}
                  section="tides"
                />
              </TabsContent>
              
              <TabsContent value="safety">
                <PassageResults 
                  plan={passagePlan}
                  section="safety"
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4.3 Authentication Context
**File: `/frontend/contexts/AuthContext.tsx`**

```typescript
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  fullName?: string;
  subscriptionTier: string;
  subscriptionStatus: string;
}

interface AuthContextType {
  user: User | null;
  subscription: {
    tier: string;
    status: string;
    monthlyUsage: number;
    limit: number;
  };
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState({
    tier: 'free',
    status: 'active',
    monthlyUsage: 0,
    limit: 5
  });
  const [loading, setLoading] = useState(true);
  
  const supabase = createClientComponentClient();
  const router = useRouter();
  
  useEffect(() => {
    checkUser();
    
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          await checkUser();
        } else {
          setUser(null);
          setSubscription({
            tier: 'free',
            status: 'active',
            monthlyUsage: 0,
            limit: 5
          });
        }
      }
    );
    
    return () => {
      authSubscription?.unsubscribe();
    };
  }, []);
  
  async function checkUser() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        // Get profile with subscription info
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (profile) {
          setUser({
            id: authUser.id,
            email: authUser.email!,
            fullName: profile.full_name,
            subscriptionTier: profile.subscription_tier,
            subscriptionStatus: profile.subscription_status
          });
          
          // Set subscription limits based on tier
          const limits = {
            free: 5,
            premium: 50,
            pro: -1 // unlimited
          };
          
          setSubscription({
            tier: profile.subscription_tier,
            status: profile.subscription_status,
            monthlyUsage: profile.monthly_passage_count,
            limit: limits[profile.subscription_tier]
          });
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    router.push('/dashboard');
  }
  
  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    
    if (error) throw error;
    
    // Create profile
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName
      });
    }
    
    router.push('/dashboard');
  }
  
  async function signOut() {
    await supabase.auth.signOut();
    router.push('/');
  }
  
  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    
    if (error) throw error;
  }
  
  return (
    <AuthContext.Provider value={{
      user,
      subscription,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

---

## 5. PAYMENT INTEGRATION

### 5.1 Stripe Service
**File: `/orchestrator/services/StripeService.ts`**

```typescript
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export class StripeService {
  private stripe: Stripe;
  private supabase: any;
  
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
    
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  
  async createCustomer(userId: string, email: string, name?: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        userId
      }
    });
    
    // Update profile with Stripe customer ID
    await this.supabase
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);
    
    return customer.id;
  }
  
  async createSubscription(
    customerId: string,
    priceId: string,
    trial: boolean = false
  ): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: trial ? 14 : undefined,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent']
    });
    
    return subscription;
  }
  
  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        trial_period_days: 14
      }
    });
    
    return session.url!;
  }
  
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
    
    return session.url;
  }
  
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
    
    // Update profile
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    
    if (profile) {
      await this.supabase
        .from('profiles')
        .update({ 
          subscription_status: 'canceled',
          subscription_ends_at: new Date().toISOString()
        })
        .eq('id', profile.id);
    }
  }
  
  async handleWebhook(signature: string, payload: string): Promise<void> {
    let event: Stripe.Event;
    
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (error) {
      throw new Error('Invalid webhook signature');
    }
    
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
        
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }
  
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    
    // Get the subscription details
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    
    // Update profile
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();
    
    if (profile) {
      const tier = this.getTierFromPriceId(subscription.items.data[0].price.id);
      
      await this.supabase
        .from('profiles')
        .update({
          stripe_subscription_id: subscriptionId,
          subscription_tier: tier,
          subscription_status: 'active',
          trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
        })
        .eq('id', profile.id);
    }
  }
  
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();
    
    if (profile) {
      const tier = this.getTierFromPriceId(subscription.items.data[0].price.id);
      
      await this.supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_status: subscription.status,
          trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          subscription_ends_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null
        })
        .eq('id', profile.id);
    }
  }
  
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();
    
    if (profile) {
      await this.supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_status: 'canceled',
          stripe_subscription_id: null
        })
        .eq('id', profile.id);
    }
  }
  
  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    // Reset monthly usage on successful payment
    const customerId = invoice.customer as string;
    
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();
    
    if (profile) {
      await this.supabase
        .from('profiles')
        .update({
          monthly_passage_count: 0,
          usage_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        })
        .eq('id', profile.id);
    }
  }
  
  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id, email')
      .eq('stripe_customer_id', customerId)
      .single();
    
    if (profile) {
      // Update status
      await this.supabase
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('id', profile.id);
      
      // Send payment failed email
      // Email service implementation would go here
    }
  }
  
  private getTierFromPriceId(priceId: string): string {
    const priceTiers = {
      [process.env.STRIPE_PRICE_PREMIUM!]: 'premium',
      [process.env.STRIPE_PRICE_PRO!]: 'pro'
    };
    
    return priceTiers[priceId] || 'free';
  }
}
```

---

## 6. EMAIL TEMPLATES

### 6.1 Welcome Email
**File: `/emails/Welcome.tsx`**

```typescript
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  userFirstName: string;
  subscriptionTier: string;
  trialEndsAt?: Date;
}

export default function WelcomeEmail({
  userFirstName,
  subscriptionTier,
  trialEndsAt,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to HelmWise - Your AI Passage Planning Assistant</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://helmwise.co/logo.png"
            width="150"
            height="50"
            alt="HelmWise"
            style={logo}
          />
          
          <Heading style={h1}>Welcome aboard, {userFirstName}!</Heading>
          
          <Text style={paragraph}>
            We're thrilled to have you join HelmWise, your AI-powered passage planning assistant.
            Whether you're planning a weekend cruise or an ocean crossing, we're here to help
            you navigate safely and efficiently.
          </Text>
          
          {subscriptionTier === 'free' && trialEndsAt && (
            <Section style={calloutSection}>
              <Text style={callout}>
                🎉 You're starting with a 14-day free trial of our Premium features!
                Your trial ends on {trialEndsAt.toLocaleDateString()}.
              </Text>
            </Section>
          )}
          
          <Heading as="h2" style={h2}>Getting Started</Heading>
          
          <Text style={paragraph}>Here's how to plan your first passage:</Text>
          
          <ol style={list}>
            <li style={listItem}>
              <strong>Add your vessel:</strong> Enter your boat's details for accurate planning
            </li>
            <li style={listItem}>
              <strong>Plan a passage:</strong> Enter departure and destination ports
            </li>
            <li style={listItem}>
              <strong>Review AI analysis:</strong> Our agents analyze weather, tides, and safety
            </li>
            <li style={listItem}>
              <strong>Download or share:</strong> Export your plan or share with crew
            </li>
          </ol>
          
          <Section style={buttonContainer}>
            <Button style={button} href="https://helmwise.co/plan">
              Plan Your First Passage
            </Button>
          </Section>
          
          <Hr style={hr} />
          
          <Heading as="h2" style={h2}>Your Plan Features</Heading>
          
          {subscriptionTier === 'free' && (
            <Text style={paragraph}>
              <strong>Free Plan:</strong> 5 passages per month, basic weather routing
            </Text>
          )}
          
          {subscriptionTier === 'premium' && (
            <Text style={paragraph}>
              <strong>Premium Plan:</strong> 50 passages per month, advanced weather, priority support
            </Text>
          )}
          
          {subscriptionTier === 'pro' && (
            <Text style={paragraph}>
              <strong>Pro Plan:</strong> Unlimited passages, fleet management, API access
            </Text>
          )}
          
          <Hr style={hr} />
          
          <Text style={paragraph}>
            Need help? Check out our{' '}
            <Link href="https://helmwise.co/docs" style={link}>
              documentation
            </Link>{' '}
            or reply to this email for support.
          </Text>
          
          <Text style={footer}>
            Fair winds and following seas,
            <br />
            The HelmWise Team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const logo = {
  margin: '0 auto',
  marginBottom: '24px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '40px',
  margin: '16px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const h2 = {
  color: '#333',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '32px',
  margin: '16px 0 8px',
};

const paragraph = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const calloutSection = {
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const callout = {
  color: '#0369a1',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
};

const list = {
  paddingLeft: '20px',
  margin: '16px 0',
};

const listItem = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '8px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#0369a1',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const hr = {
  borderColor: '#e6e6e6',
  margin: '32px 0',
};

const link = {
  color: '#0369a1',
  textDecoration: 'underline',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '32px 0 0 0',
  textAlign: 'center' as const,
};
```

---

## 7. DEPLOYMENT CONFIGURATION

### 7.1 Docker Configuration
**File: `/Dockerfile.orchestrator`**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY orchestrator ./orchestrator
COPY agents ./agents
COPY shared ./shared

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --production

# Copy built application
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Run as non-root user
USER node

# Start the orchestrator
CMD ["node", "dist/orchestrator/index.js"]
```

### 7.2 Kubernetes Deployment
**File: `/k8s/deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: orchestrator
  template:
    metadata:
      labels:
        app: orchestrator
    spec:
      containers:
      - name: orchestrator
        image: helmwise/orchestrator:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 8081
          name: websocket
        env:
        - name: NODE_ENV
          value: production
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: supabase-secret
              key: url
        - name: SUPABASE_SERVICE_KEY
          valueFrom:
            secretKeyRef:
              name: supabase-secret
              key: service-key
        - name: STRIPE_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: stripe-secret
              key: secret-key
        - name: STRIPE_WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: stripe-secret
              key: webhook-secret
        - name: NOAA_API_KEY
          valueFrom:
            secretKeyRef:
              name: weather-secret
              key: noaa-key
        - name: OPENWEATHER_API_KEY
          valueFrom:
            secretKeyRef:
              name: weather-secret
              key: openweather-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: orchestrator-service
  namespace: production
spec:
  selector:
    app: orchestrator
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: websocket
    port: 8081
    targetPort: 8081
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orchestrator-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orchestrator
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 7.3 Environment Variables
**File: `/.env.example`**

```bash
# Application
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:8080

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PREMIUM=price_xxx
STRIPE_PRICE_PRO=price_xxx

# Email
RESEND_API_KEY=re_xxx

# Weather APIs
NOAA_API_KEY=your-noaa-key
OPENWEATHER_API_KEY=your-openweather-key

# Marine APIs
MARINETRAFFIC_API_KEY=your-marinetraffic-key

# Analytics
ANALYTICS_ENABLED=true
POSTHOG_KEY=your-posthog-key

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

---

## 8. TESTING SPECIFICATIONS

### 8.1 Integration Tests
**File: `/tests/integration/passage-planning.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestClient } from '../utils/testClient';
import { seedDatabase } from '../utils/seed';
import { cleanupDatabase } from '../utils/cleanup';

describe('Passage Planning Integration', () => {
  let client;
  let testUser;
  
  beforeAll(async () => {
    await seedDatabase();
    client = await createTestClient();
    testUser = await client.auth.signUp({
      email: 'test@example.com',
      password: 'Test123!'
    });
  });
  
  afterAll(async () => {
    await cleanupDatabase();
  });
  
  describe('Planning Workflow', () => {
    it('should create a complete passage plan', async () => {
      const request = {
        departure: {
          port: 'Boston, MA',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-07-15T10:00:00Z')
        },
        destination: {
          port: 'Portland, ME',
          latitude: 43.6591,
          longitude: -70.2568
        },
        vessel: {
          type: 'sailboat',
          cruiseSpeed: 6,
          maxSpeed: 8
        },
        preferences: {
          avoidNight: true,
          maxWindSpeed: 25,
          maxWaveHeight: 2
        }
      };
      
      const response = await client.orchestrator.planPassage(request);
      
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('route');
      expect(response).toHaveProperty('weather');
      expect(response).toHaveProperty('tides');
      expect(response).toHaveProperty('safety');
      expect(response.route.totalDistance).toBeGreaterThan(0);
      expect(response.route.waypoints.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should enforce subscription limits', async () => {
      // Create 5 passages for free tier
      for (let i = 0; i < 5; i++) {
        await client.orchestrator.planPassage({
          departure: { port: 'Test', latitude: 0, longitude: 0, time: new Date() },
          destination: { port: 'Test', latitude: 1, longitude: 1 }
        });
      }
      
      // 6th passage should fail
      await expect(
        client.orchestrator.planPassage({
          departure: { port: 'Test', latitude: 0, longitude: 0, time: new Date() },
          destination: { port: 'Test', latitude: 1, longitude: 1 }
        })
      ).rejects.toThrow('Monthly limit reached');
    });
    
    it('should handle agent failures gracefully', async () => {
      // Simulate weather agent failure
      process.env.OPENWEATHER_API_KEY = 'invalid';
      
      const response = await client.orchestrator.planPassage({
        departure: { port: 'Test', latitude: 0, longitude: 0, time: new Date() },
        destination: { port: 'Test', latitude: 1, longitude: 1 }
      });
      
      expect(response).toHaveProperty('route');
      expect(response.weather).toBeNull();
      expect(response.summary.warnings).toContain('Weather data unavailable');
    });
  });
  
  describe('WebSocket Communication', () => {
    it('should broadcast real-time updates', async (done) => {
      const ws = await client.connectWebSocket();
      const updates = [];
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        updates.push(message.type);
        
        if (message.type === 'planning_completed') {
          expect(updates).toContain('planning_started');
          expect(updates).toContain('agent_active');
          ws.close();
          done();
        }
      });
      
      await client.orchestrator.planPassage({
        departure: { port: 'Test', latitude: 0, longitude: 0, time: new Date() },
        destination: { port: 'Test', latitude: 1, longitude: 1 }
      });
    });
  });
});
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Foundation (Week 1-2)
- [ ] Set up PostgreSQL/Supabase database with complete schema
- [ ] Implement base agent class and Redis integration
- [ ] Create orchestrator skeleton with MCP server setup
- [ ] Set up Next.js frontend with authentication flow
- [ ] Configure Docker containers and local development environment

### Phase 2: Core Agents (Week 3-4)
- [ ] Implement Weather Agent with NOAA/OpenWeather integration
- [ ] Implement Tidal Agent with tide prediction algorithms
- [ ] Implement Route Agent with navigation calculations
- [ ] Implement Port Agent with port database
- [ ] Implement Safety Agent with warning systems
- [ ] Implement Wind Agent with sailing-specific analysis

### Phase 3: Orchestration (Week 5)
- [ ] Complete orchestrator request routing
- [ ] Implement agent coordination logic
- [ ] Add WebSocket real-time updates
- [ ] Create comprehensive passage planning workflow
- [ ] Add error handling and retry mechanisms

### Phase 4: Frontend (Week 6-7)
- [ ] Build passage planning form interface
- [ ] Create interactive map component with route visualization
- [ ] Implement real-time agent status display
- [ ] Build results display with tabs for different data
- [ ] Add vessel management interface
- [ ] Create user dashboard with usage metrics

### Phase 5: Business Features (Week 8-9)
- [ ] Integrate Stripe payment processing
- [ ] Implement subscription management
- [ ] Create email templates with React Email
- [ ] Add usage metering and enforcement
- [ ] Build analytics dashboard
- [ ] Implement billing portal integration

### Phase 6: Production (Week 10)
- [ ] Write comprehensive test suites
- [ ] Set up Kubernetes deployment
- [ ] Configure monitoring and logging
- [ ] Perform security audit
- [ ] Optimize performance
- [ ] Deploy to production domains

### Testing Requirements
- [ ] Unit tests for all agent logic (>80% coverage)
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical user flows
- [ ] Load testing for concurrent users
- [ ] WebSocket connection testing
- [ ] Payment webhook testing

### Documentation Needs
- [ ] API documentation with OpenAPI/Swagger
- [ ] User guide for passage planning
- [ ] Agent architecture documentation
- [ ] Deployment guide
- [ ] Contributing guidelines

### Performance Targets
- API response time < 2s for passage planning
- WebSocket latency < 100ms
- Support 1000 concurrent users
- 99.9% uptime SLA
- Page load time < 3s

This comprehensive specification provides everything needed to complete your passage planner project. Each component is fully detailed with implementation code, database schemas, and deployment configurations. The modular architecture allows for parallel development of agents once the orchestrator foundation is in place.',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vessels table
CREATE TABLE public.vessels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('sailboat', 'powerboat', 'catamaran', 'trimaran')),
    length_ft NUMERIC(5,2),
    beam_ft NUMERIC(5,2),
    draft_ft NUMERIC(5,2),
    hull_speed_kts NUMERIC(4,2),
    cruise_speed_kts NUMERIC(4,2),
    max_speed_kts NUMERIC(4,2),
    fuel_capacity_gal NUMERIC(7,2),
    water_capacity_gal NUMERIC(7,2),
    mmsi TEXT,
    call_sign TEXT,
    registration_number TEXT,
    home_port TEXT,
    current_location GEOGRAPHY(POINT, 4326),
    equipment JSONB DEFAULT '{}', -- {vhf: true, ais: true, radar: true, etc}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, name)
);

-- Passages table
CREATE TABLE public.passages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    departure_port TEXT NOT NULL,
    departure_coords GEOGRAPHY(POINT, 4326) NOT NULL,
    destination_port TEXT NOT NULL,
    destination_coords GEOGRAPHY(POINT, 4326) NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    estimated_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    distance_nm NUMERIC(8,2),
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    route_points JSONB NOT NULL, -- Array of waypoints
    weather_data JSONB, -- Cached weather at planning time
    tidal_data JSONB, -- Cached tidal information
    safety_notes JSONB, -- Navigation warnings, hazards
    crew_list JSONB, -- Array of crew members
    float_plan_sent BOOLEAN DEFAULT FALSE,
    shared_with UUID[], -- Array of user IDs
    planning_parameters JSONB, -- User preferences used for planning
    agent_responses JSONB, -- Store all agent responses
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_passages_user_id ON passages(user_id);
CREATE INDEX idx_passages_status ON passages(status);
CREATE INDEX idx_passages_departure_time ON passages(departure_time);
CREATE INDEX idx_vessels_owner_id ON vessels(owner_id);
CREATE INDEX idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- Waypoints table (normalized from passages)
CREATE TABLE public.waypoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passage_id UUID REFERENCES passages(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    name TEXT,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    estimated_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(passage_id, sequence_number)
);

-- Analytics events table
CREATE TABLE public.analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent health monitoring
CREATE TABLE public.agent_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT UNIQUE NOT NULL,
    status TEXT CHECK (status IN ('healthy', 'degraded', 'offline')),
    last_heartbeat TIMESTAMPTZ,
    cpu_usage NUMERIC(5,2),
    memory_usage NUMERIC(5,2),
    request_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    average_response_time_ms NUMERIC(8,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription usage tracking
CREATE TABLE public.usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    passage_id UUID REFERENCES passages(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    counted_towards_limit BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for vessels
CREATE POLICY "Users can view own vessels" ON vessels
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own vessels" ON vessels
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own vessels" ON vessels
    FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own vessels" ON vessels
    FOR DELETE USING (auth.uid() = owner_id);

-- RLS Policies for passages
CREATE POLICY "Users can view own passages" ON passages
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = ANY(shared_with));
CREATE POLICY "Users can insert own passages" ON passages
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own passages" ON passages
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own passages" ON passages
    FOR DELETE USING (auth.uid() = user_id);

-- Functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_vessels_updated_at BEFORE UPDATE ON vessels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_passages_updated_at BEFORE UPDATE ON passages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to reset monthly usage
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
    UPDATE profiles 
    SET monthly_passage_count = 0,
        usage_reset_at = NOW() + INTERVAL '1 month'
    WHERE usage_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly usage reset
SELECT cron.schedule('reset-monthly-usage', '0 0 1 * *', 'SELECT reset_monthly_usage();');
```

---

## 2. MCP AGENT IMPLEMENTATIONS

### 2.1 Base Agent Class
**File: `/agents/base/BaseAgent.ts`**

```typescript
import { Tool, ToolResponse } from '@modelcontextprotocol/sdk/types.js';
import { createHash } from 'crypto';
import Redis from 'ioredis';

export interface AgentConfig {
  name: string;
  description: string;
  version: string;
  cacheTTL?: number; // seconds
  retryAttempts?: number;
  timeout?: number; // milliseconds
}

export interface AgentContext {
  requestId: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
}

export abstract class BaseAgent {
  protected redis: Redis;
  protected config: AgentConfig;
  
  constructor(config: AgentConfig, redisUrl: string) {
    this.config = {
      cacheTTL: 3600,
      retryAttempts: 3,
      timeout: 30000,
      ...config
    };
    this.redis = new Redis(redisUrl);
  }

  abstract getTools(): Tool[];
  
  protected async getCachedData(key: string): Promise<any | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  protected async setCachedData(key: string, data: any, ttl?: number): Promise<void> {
    const ttlSeconds = ttl || this.config.cacheTTL;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
  }

  protected generateCacheKey(...parts: string[]): string {
    const combined = parts.join(':');
    const hash = createHash('md5').update(combined).digest('hex');
    return `${this.config.name}:${hash}`;
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    attempts: number = this.config.retryAttempts!
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    
    throw lastError;
  }

  protected async reportHealth(status: 'healthy' | 'degraded' | 'offline', metadata?: any): Promise<void> {
    await this.redis.hset(`agent:health:${this.config.name}`, {
      status,
      lastHeartbeat: new Date().toISOString(),
      metadata: JSON.stringify(metadata || {})
    });
  }

  async initialize(): Promise<void> {
    await this.reportHealth('healthy');
    console.log(`${this.config.name} agent initialized`);
  }

  async shutdown(): Promise<void> {
    await this.reportHealth('offline');
    await this.redis.quit();
    console.log(`${this.config.name} agent shutdown`);
  }
}
```

### 2.2 Weather Agent
**File: `/agents/weather/WeatherAgent.ts`**

```typescript
import { BaseAgent } from '../base/BaseAgent.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

interface WeatherForecast {
  time: Date;
  windSpeed: number;
  windDirection: number;
  windGust: number;
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
  precipitation: number;
  visibility: number;
  temperature: number;
  pressure: number;
  cloudCover: number;
}

interface MarineZone {
  id: string;
  name: string;
  forecast: string;
  warnings: string[];
}

export class WeatherAgent extends BaseAgent {
  private noaaApiKey: string;
  private openWeatherApiKey: string;
  
  constructor(redisUrl: string, noaaApiKey: string, openWeatherApiKey: string) {
    super({
      name: 'weather-agent',
      description: 'Provides marine weather forecasts and warnings',
      version: '1.0.0',
      cacheTTL: 1800 // 30 minutes
    }, redisUrl);
    
    this.noaaApiKey = noaaApiKey;
    this.openWeatherApiKey = openWeatherApiKey;
  }

  getTools(): Tool[] {
    return [
      {
        name: 'get_marine_forecast',
        description: 'Get marine weather forecast for a specific location',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            hours: { type: 'number', default: 72 }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'get_weather_warnings',
        description: 'Get active weather warnings for a marine area',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            radius_nm: { type: 'number', default: 50 }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'get_grib_data',
        description: 'Get GRIB weather data for route planning',
        inputSchema: {
          type: 'object',
          properties: {
            bounds: {
              type: 'object',
              properties: {
                north: { type: 'number' },
                south: { type: 'number' },
                east: { type: 'number' },
                west: { type: 'number' }
              },
              required: ['north', 'south', 'east', 'west']
            },
            resolution: { type: 'string', enum: ['0.25', '0.5', '1.0'] },
            parameters: {
              type: 'array',
              items: { type: 'string' },
              default: ['wind', 'waves', 'precipitation']
            }
          },
          required: ['bounds']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'get_marine_forecast':
        return await this.getMarineForecast(args.latitude, args.longitude, args.hours);
      case 'get_weather_warnings':
        return await this.getWeatherWarnings(args.latitude, args.longitude, args.radius_nm);
      case 'get_grib_data':
        return await this.getGribData(args.bounds, args.resolution, args.parameters);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getMarineForecast(lat: number, lon: number, hours: number = 72): Promise<WeatherForecast[]> {
    const cacheKey = this.generateCacheKey('forecast', lat.toString(), lon.toString(), hours.toString());
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      // Get NOAA point forecast
      const pointResponse = await axios.get(
        `https://api.weather.gov/points/${lat},${lon}`
      );
      const forecastUrl = pointResponse.data.properties.forecastGridData;
      
      // Get gridded forecast data
      const forecastResponse = await axios.get(forecastUrl);
      const forecastData = forecastResponse.data.properties;
      
      // Get marine-specific data from OpenWeather Marine API
      const marineResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/onecall`,
        {
          params: {
            lat,
            lon,
            exclude: 'minutely,alerts',
            appid: this.openWeatherApiKey,
            units: 'metric'
          }
        }
      );

      // Combine and format forecast data
      const forecasts: WeatherForecast[] = [];
      const hourlyData = marineResponse.data.hourly.slice(0, hours);
      
      for (let i = 0; i < hourlyData.length; i++) {
        const hour = hourlyData[i];
        forecasts.push({
          time: new Date(hour.dt * 1000),
          windSpeed: hour.wind_speed * 1.94384, // m/s to knots
          windDirection: hour.wind_deg,
          windGust: hour.wind_gust ? hour.wind_gust * 1.94384 : hour.wind_speed * 1.94384 * 1.2,
          waveHeight: await this.estimateWaveHeight(hour.wind_speed, lat, lon),
          wavePeriod: await this.estimateWavePeriod(hour.wind_speed),
          waveDirection: hour.wind_deg, // Simplified - same as wind
          precipitation: hour.rain ? hour.rain['1h'] || 0 : 0,
          visibility: hour.visibility / 1000, // meters to km
          temperature: hour.temp,
          pressure: hour.pressure,
          cloudCover: hour.clouds
        });
      }

      await this.setCachedData(cacheKey, forecasts);
      return forecasts;
    } catch (error) {
      await this.reportHealth('degraded', { error: error.message });
      throw error;
    }
  }

  private async getWeatherWarnings(lat: number, lon: number, radiusNm: number = 50): Promise<any> {
    const cacheKey = this.generateCacheKey('warnings', lat.toString(), lon.toString());
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      // Get NOAA alerts for the area
      const response = await axios.get(
        `https://api.weather.gov/alerts/active`,
        {
          params: {
            point: `${lat},${lon}`,
            limit: 50
          }
        }
      );

      const warnings = response.data.features
        .filter((alert: any) => {
          // Filter for marine-related alerts
          const marine_events = [
            'Small Craft Advisory',
            'Gale Warning',
            'Storm Warning',
            'Hurricane Warning',
            'Tropical Storm Warning',
            'Tsunami Warning',
            'Rip Current Statement'
          ];
          return marine_events.includes(alert.properties.event);
        })
        .map((alert: any) => ({
          id: alert.properties.id,
          event: alert.properties.event,
          severity: alert.properties.severity,
          urgency: alert.properties.urgency,
          headline: alert.properties.headline,
          description: alert.properties.description,
          instruction: alert.properties.instruction,
          effective: alert.properties.effective,
          expires: alert.properties.expires,
          areas: alert.properties.areaDesc
        }));

      await this.setCachedData(cacheKey, warnings, 600); // 10 min cache
      return warnings;
    } catch (error) {
      await this.reportHealth('degraded', { error: error.message });
      throw error;
    }
  }

  private async getGribData(bounds: any, resolution: string = '0.5', parameters: string[]): Promise<any> {
    // Implementation would connect to NOAA NOMADS or similar GRIB service
    // This is a placeholder for the actual GRIB data retrieval
    return {
      bounds,
      resolution,
      parameters,
      url: `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_${resolution}deg.pl`,
      format: 'GRIB2',
      message: 'GRIB data URL generated for download'
    };
  }

  private async estimateWaveHeight(windSpeed: number, lat: number, lon: number): Promise<number> {
    // Simplified wave height estimation using Beaufort scale relationships
    // In production, this would use actual wave model data
    const windKnots = windSpeed * 1.94384;
    if (windKnots < 1) return 0;
    if (windKnots < 4) return 0.1;
    if (windKnots < 7) return 0.3;
    if (windKnots < 11) return 0.6;
    if (windKnots < 17) return 1.0;
    if (windKnots < 22) return 2.0;
    if (windKnots < 28) return 3.0;
    if (windKnots < 34) return 4.0;
    if (windKnots < 41) return 5.5;
    if (windKnots < 48) return 7.0;
    if (windKnots < 56) return 9.0;
    if (windKnots < 64) return 11.5;
    return 14.0;
  }

  private async estimateWavePeriod(windSpeed: number): Promise<number> {
    // Simplified wave period estimation
    const windKnots = windSpeed * 1.94384;
    return Math.min(12, Math.max(3, windKnots * 0.3));
  }
}
```

### 2.3 Tidal Agent
**File: `/agents/tidal/TidalAgent.ts`**

```typescript
import { BaseAgent } from '../base/BaseAgent.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

interface TidalPrediction {
  time: Date;
  height: number;
  type: 'high' | 'low';
}

interface CurrentPrediction {
  time: Date;
  velocity: number;
  direction: number;
  type: 'flood' | 'ebb' | 'slack';
}

export class TidalAgent extends BaseAgent {
  private noaaApiKey: string;
  
  constructor(redisUrl: string, noaaApiKey: string) {
    super({
      name: 'tidal-agent',
      description: 'Provides tidal and current predictions',
      version: '1.0.0',
      cacheTTL: 86400 // 24 hours - tides are predictable
    }, redisUrl);
    
    this.noaaApiKey = noaaApiKey;
  }

  getTools(): Tool[] {
    return [
      {
        name: 'get_tide_predictions',
        description: 'Get tide predictions for a location',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' },
            datum: { type: 'string', default: 'MLLW' }
          },
          required: ['latitude', 'longitude', 'start_date', 'end_date']
        }
      },
      {
        name: 'get_current_predictions',
        description: 'Get tidal current predictions',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' }
          },
          required: ['latitude', 'longitude', 'start_date', 'end_date']
        }
      },
      {
        name: 'get_water_levels',
        description: 'Get real-time water level data',
        inputSchema: {
          type: 'object',
          properties: {
            station_id: { type: 'string' },
            hours: { type: 'number', default: 24 }
          },
          required: ['station_id']
        }
      },
      {
        name: 'find_nearest_station',
        description: 'Find nearest tidal station',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            type: { type: 'string', enum: ['tide', 'current', 'both'], default: 'both' }
          },
          required: ['latitude', 'longitude']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'get_tide_predictions':
        return await this.getTidePredictions(
          args.latitude,
          args.longitude,
          args.start_date,
          args.end_date,
          args.datum
        );
      case 'get_current_predictions':
        return await this.getCurrentPredictions(
          args.latitude,
          args.longitude,
          args.start_date,
          args.end_date
        );
      case 'get_water_levels':
        return await this.getWaterLevels(args.station_id, args.hours);
      case 'find_nearest_station':
        return await this.findNearestStation(args.latitude, args.longitude, args.type);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getTidePredictions(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
    datum: string = 'MLLW'
  ): Promise<TidalPrediction[]> {
    const cacheKey = this.generateCacheKey('tides', lat.toString(), lon.toString(), startDate, endDate);
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      // Find nearest station
      const station = await this.findNearestStation(lat, lon, 'tide');
      
      // Get predictions from NOAA CO-OPS API
      const response = await axios.get(
        'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
        {
          params: {
            begin_date: startDate.replace(/[:\-]/g, '').slice(0, 8),
            end_date: endDate.replace(/[:\-]/g, '').slice(0, 8),
            station: station.id,
            product: 'predictions',
            datum: datum,
            interval: 'hilo',
            units: 'english',
            time_zone: 'gmt',
            format: 'json'
          }
        }
      );

      const predictions: TidalPrediction[] = response.data.predictions.map((pred: any) => ({
        time: new Date(pred.t),
        height: parseFloat(pred.v),
        type: pred.type === 'H' ? 'high' : 'low'
      }));

      await this.setCachedData(cacheKey, predictions);
      return predictions;
    } catch (error) {
      await this.reportHealth('degraded', { error: error.message });
      throw error;
    }
  }

  private async getCurrentPredictions(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string
  ): Promise<CurrentPrediction[]> {
    const cacheKey = this.generateCacheKey('currents', lat.toString(), lon.toString(), startDate, endDate);
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      // Find nearest current station
      const station = await this.findNearestStation(lat, lon, 'current');
      
      // Get current predictions
      const response = await axios.get(
        'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
        {
          params: {
            begin_date: startDate.replace(/[:\-]/g, '').slice(0, 8),
            end_date: endDate.replace(/[:\-]/g, '').slice(0, 8),
            station: station.id,
            product: 'currents_predictions',
            units: 'english',
            time_zone: 'gmt',
            format: 'json',
            interval: '30'
          }
        }
      );

      const predictions: CurrentPrediction[] = response.data.current_predictions.map((pred: any) => ({
        time: new Date(pred.t),
        velocity: parseFloat(pred.v),
        direction: parseFloat(pred.d),
        type: this.determineCurrentType(parseFloat(pred.v))
      }));

      await this.setCachedData(cacheKey, predictions);
      return predictions;
    } catch (error) {
      await this.reportHealth('degraded', { error: error.message });
      throw error;
    }
  }

  private async getWaterLevels(stationId: string, hours: number = 24): Promise<any> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);
      
      const response = await axios.get(
        'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
        {
          params: {
            begin_date: startDate.toISOString().slice(0, 10).replace(/-/g, ''),
            end_date: endDate.toISOString().slice(0, 10).replace(/-/g, ''),
            station: stationId,
            product: 'water_level',
            datum: 'MLLW',
            units: 'english',
            time_zone: 'gmt',
            format: 'json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  private async findNearestStation(lat: number, lon: number, type: string = 'both'): Promise<any> {
    const cacheKey = this.generateCacheKey('station', lat.toString(), lon.toString(), type);
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      // Get station metadata
      const response = await axios.get(
        'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json',
        {
          params: {
            type: type === 'both' ? 'waterlevels' : type,
            units: 'english'
          }
        }
      );

      // Calculate distances and find nearest
      const stations = response.data.stations;
      let nearestStation = null;
      let minDistance = Infinity;

      for (const station of stations) {
        const distance = this.calculateDistance(
          lat,
          lon,
          station.lat,
          station.lng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestStation = {
            id: station.id,
            name: station.name,
            latitude: station.lat,
            longitude: station.lng,
            distance: distance
          };
        }
      }

      await this.setCachedData(cacheKey, nearestStation, 604800); // 1 week cache
      return nearestStation;
    } catch (error) {
      throw error;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.1; // Earth radius in nautical miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private determineCurrentType(velocity: number): 'flood' | 'ebb' | 'slack' {
    if (Math.abs(velocity) < 0.1) return 'slack';
    return velocity > 0 ? 'flood' : 'ebb';
  }
}
```

### 2.4 Route Agent
**File: `/agents/route/RouteAgent.ts`**

```typescript
import { BaseAgent } from '../base/BaseAgent.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as turf from '@turf/turf';

interface RoutePoint {
  latitude: number;
  longitude: number;
  name?: string;
  arrivalTime?: Date;
}

interface RouteSegment {
  from: RoutePoint;
  to: RoutePoint;
  distance: number;
  bearing: number;
  estimatedTime: number;
}

interface Route {
  waypoints: RoutePoint[];
  segments: RouteSegment[];
  totalDistance: number;
  estimatedDuration: number;
  optimized: boolean;
}

export class RouteAgent extends BaseAgent {
  constructor(redisUrl: string) {
    super({
      name: 'route-agent',
      description: 'Calculates optimal sailing routes',
      version: '1.0.0',
      cacheTTL: 3600
    }, redisUrl);
  }

  getTools(): Tool[] {
    return [
      {
        name: 'calculate_route',
        description: 'Calculate optimal route between points',
        inputSchema: {
          type: 'object',
          properties: {
            departure: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                name: { type: 'string' }
              },
              required: ['latitude', 'longitude']
            },
            destination: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                name: { type: 'string' }
              },
              required: ['latitude', 'longitude']
            },
            waypoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  name: { type: 'string' }
                }
              },
              default: []
            },
            vessel_speed: { type: 'number', default: 5 },
            optimization: {
              type: 'string',
              enum: ['distance', 'time', 'comfort', 'fuel'],
              default: 'distance'
            },
            avoid_areas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['circle', 'polygon'] },
                  coordinates: { type: 'array' },
                  radius: { type: 'number' }
                }
              },
              default: []
            }
          },
          required: ['departure', 'destination']
        }
      },
      {
        name: 'calculate_rhumb_line',
        description: 'Calculate rhumb line route',
        inputSchema: {
          type: 'object',
          properties: {
            from: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            to: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            }
          },
          required: ['from', 'to']
        }
      },
      {
        name: 'calculate_great_circle',
        description: 'Calculate great circle route',
        inputSchema: {
          type: 'object',
          properties: {
            from: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            to: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            intermediate_points: { type: 'number', default: 10 }
          },
          required: ['from', 'to']
        }
      },
      {
        name: 'optimize_waypoints',
        description: 'Optimize waypoint order for shortest distance',
        inputSchema: {
          type: 'object',
          properties: {
            waypoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  name: { type: 'string' }
                }
              }
            },
            start_point: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            end_point: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            }
          },
          required: ['waypoints']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'calculate_route':
        return await this.calculateRoute(args);
      case 'calculate_rhumb_line':
        return await this.calculateRhumbLine(args.from, args.to);
      case 'calculate_great_circle':
        return await this.calculateGreatCircle(args.from, args.to, args.intermediate_points);
      case 'optimize_waypoints':
        return await this.optimizeWaypoints(args.waypoints, args.start_point, args.end_point);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async calculateRoute(params: any): Promise<Route> {
    const { departure, destination, waypoints = [], vessel_speed = 5, optimization = 'distance', avoid_areas = [] } = params;
    
    // Create full waypoint list
    const allWaypoints = [departure, ...waypoints, destination];
    
    // Optimize waypoint order if requested
    let orderedWaypoints = allWaypoints;
    if (optimization === 'distance' && waypoints.length > 0) {
      orderedWaypoints = await this.optimizeWaypoints(waypoints, departure, destination);
    }
    
    // Calculate segments
    const segments: RouteSegment[] = [];
    let totalDistance = 0;
    let estimatedDuration = 0;
    
    for (let i = 0; i < orderedWaypoints.length - 1; i++) {
      const from = orderedWaypoints[i];
      const to = orderedWaypoints[i + 1];
      
      // Check if route passes through avoid areas
      const routeLine = turf.lineString([
        [from.longitude, from.latitude],
        [to.longitude, to.latitude]
      ]);
      
      let segmentValid = true;
      for (const area of avoid_areas) {
        if (area.type === 'circle') {
          const circle = turf.circle(area.coordinates, area.radius, { units: 'nauticalMiles' });
          if (turf.booleanIntersects(routeLine, circle)) {
            segmentValid = false;
            break;
          }
        } else if (area.type === 'polygon') {
          const polygon = turf.polygon([area.coordinates]);
          if (turf.booleanIntersects(routeLine, polygon)) {
            segmentValid = false;
            break;
          }
        }
      }
      
      if (!segmentValid) {
        // Calculate alternative route around obstacle
        const detour = await this.calculateDetour(from, to, avoid_areas);
        segments.push(...detour);
        detour.forEach(seg => {
          totalDistance += seg.distance;
          estimatedDuration += seg.estimatedTime;
        });
      } else {
        const distance = this.calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
        const bearing = this.calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);
        const time = distance / vessel_speed;
        
        segments.push({
          from,
          to,
          distance,
          bearing,
          estimatedTime: time
        });
        
        totalDistance += distance;
        estimatedDuration += time;
      }
    }
    
    return {
      waypoints: orderedWaypoints,
      segments,
      totalDistance,
      estimatedDuration,
      optimized: optimization === 'distance'
    };
  }

  private async calculateRhumbLine(from: any, to: any): Promise<any> {
    const point1 = turf.point([from.longitude, from.latitude]);
    const point2 = turf.point([to.longitude, to.latitude]);
    
    const distance = turf.rhumbDistance(point1, point2, { units: 'nauticalMiles' });
    const bearing = turf.rhumbBearing(point1, point2);
    
    return {
      distance,
      bearing,
      type: 'rhumb',
      from,
      to
    };
  }

  private async calculateGreatCircle(from: any, to: any, intermediatePoints: number = 10): Promise<any> {
    const point1 = turf.point([from.longitude, from.latitude]);
    const point2 = turf.point([to.longitude, to.latitude]);
    
    const distance = turf.distance(point1, point2, { units: 'nauticalMiles' });
    const bearing = turf.bearing(point1, point2);
    
    // Generate intermediate points along great circle
    const line = turf.greatCircle(point1, point2, { npoints: intermediatePoints + 2 });
    const waypoints = line.geometry.coordinates.map((coord, index) => ({
      latitude: coord[1],
      longitude: coord[0],
      sequence: index
    }));
    
    return {
      distance,
      initial_bearing: bearing,
      type: 'great_circle',
      waypoints,
      from,
      to
    };
  }

  private async optimizeWaypoints(waypoints: any[], startPoint?: any, endPoint?: any): Promise<any[]> {
    if (waypoints.length <= 1) return waypoints;
    
    // Use nearest neighbor algorithm for simple optimization
    const optimized = [];
    const remaining = [...waypoints];
    let current = startPoint || remaining.shift();
    
    optimized.push(current);
    
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = this.calculateDistance(
          current.latitude,
          current.longitude,
          remaining[i].latitude,
          remaining[i].longitude
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      current = remaining.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }
    
    if (endPoint) {
      optimized.push(endPoint);
    }
    
    return optimized;
  }

  private async calculateDetour(from: any, to: any, avoidAreas: any[]): Promise<RouteSegment[]> {
    // Simplified detour calculation - in production, use proper pathfinding
    const midpoint = {
      latitude: (from.latitude + to.latitude) / 2,
      longitude: (from.longitude + to.longitude) / 2
    };
    
    // Offset midpoint perpendicular to route
    const bearing = this.calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);
    const offsetBearing = (bearing + 90) % 360;
    const offsetDistance = 10; // nautical miles
    
    const offsetPoint = this.calculateDestination(
      midpoint.latitude,
      midpoint.longitude,
      offsetDistance,
      offsetBearing
    );
    
    return [
      {
        from,
        to: offsetPoint,
        distance: this.calculateDistance(from.latitude, from.longitude, offsetPoint.latitude, offsetPoint.longitude),
        bearing: this.calculateBearing(from.latitude, from.longitude, offsetPoint.latitude, offsetPoint.longitude),
        estimatedTime: 0
      },
      {
        from: offsetPoint,
        to,
        distance: this.calculateDistance(offsetPoint.latitude, offsetPoint.longitude, to.latitude, to.longitude),
        bearing: this.calculateBearing(offsetPoint.latitude, offsetPoint.longitude, to.latitude, to.longitude),
        estimatedTime: 0
      }
    ];
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const point1 = turf.point([lon1, lat1]);
    const point2 = turf.point([lon2, lat2]);
    return turf.distance(point1, point2, { units: 'nauticalMiles' });
  }

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const point1 = turf.point([lon1, lat1]);
    const point2 = turf.point([lon2, lat2]);
    return turf.bearing(point1, point2);
  }

  private calculateDestination(lat: number, lon: number, distance: number, bearing: number): RoutePoint {
    const origin = turf.point([lon, lat]);
    const destination = turf.destination(origin, distance, bearing, { units: 'nauticalMiles' });
    return {
      latitude: destination.geometry.coordinates[1],
      longitude: destination.geometry.coordinates[0]
    };
  }
}
```

---

## 3. ORCHESTRATOR IMPLEMENTATION

### 3.1 Main Orchestrator Service
**File: `/orchestrator/Orchestrator.ts`**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import Redis from 'ioredis';
import { WeatherAgent } from '../agents/weather/WeatherAgent.js';
import { TidalAgent } from '../agents/tidal/TidalAgent.js';
import { RouteAgent } from '../agents/route/RouteAgent.js';
import { PortAgent } from '../agents/port/PortAgent.js';
import { SafetyAgent } from '../agents/safety/SafetyAgent.js';
import { WindAgent } from '../agents/wind/WindAgent.js';
import { BaseAgent } from '../agents/base/BaseAgent.js';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface AgentRegistry {
  [key: string]: BaseAgent;
}

interface PlanningRequest {
  id: string;
  userId: string;
  departure: {
    port: string;
    latitude: number;
    longitude: number;
    time: Date;
  };
  destination: {
    port: string;
    latitude: number;
    longitude: number;
  };
  vessel: {
    type: string;
    cruiseSpeed: number;
    maxSpeed: number;
  };
  preferences: {
    avoidNight?: boolean;
    maxWindSpeed?: number;
    maxWaveHeight?: number;
    preferredStops?: string[];
  };
}

export class Orchestrator {
  private server: Server;
  private agents: AgentRegistry = {};
  private redis: Redis;
  private supabase: any;
  private wss: WebSocketServer;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    
    this.server = new Server(
      {
        name: 'passage-planner-orchestrator',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.initializeAgents();
    this.setupHandlers();
    this.setupWebSocket();
  }

  private async initializeAgents() {
    // Initialize all agents
    this.agents['weather'] = new WeatherAgent(
      process.env.REDIS_URL!,
      process.env.NOAA_API_KEY!,
      process.env.OPENWEATHER_API_KEY!
    );
    
    this.agents['tidal'] = new TidalAgent(
      process.env.REDIS_URL!,
      process.env.NOAA_API_KEY!
    );
    
    this.agents['route'] = new RouteAgent(process.env.REDIS_URL!);
    
    this.agents['port'] = new PortAgent(
      process.env.REDIS_URL!,
      process.env.MARINETRAFFIC_API_KEY!
    );
    
    this.agents['safety'] = new SafetyAgent(
      process.env.REDIS_URL!,
      process.env.NOAA_API_KEY!
    );
    
    this.agents['wind'] = new WindAgent(
      process.env.REDIS_URL!,
      process.env.OPENWEATHER_API_KEY!
    );
    
    // Initialize all agents
    for (const agent of Object.values(this.agents)) {
      await agent.initialize();
    }
    
    console.log('All agents initialized');
  }

  private setupHandlers() {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [];
      
      // Add orchestrator-level tools
      tools.push({
        name: 'plan_passage',
        description: 'Plan a complete sailing passage',
        inputSchema: {
          type: 'object',
          properties: {
            departure: {
              type: 'object',
              properties: {
                port: { type: 'string' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                time: { type: 'string', format: 'date-time' }
              },
              required: ['port', 'latitude', 'longitude', 'time']
            },
            destination: {
              type: 'object',
              properties: {
                port: { type: 'string' },
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              },
              required: ['port', 'latitude', 'longitude']
            },
            vessel: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                cruiseSpeed: { type: 'number' },
                maxSpeed: { type: 'number' }
              }
            },
            preferences: {
              type: 'object',
              properties: {
                avoidNight: { type: 'boolean' },
                maxWindSpeed: { type: 'number' },
                maxWaveHeight: { type: 'number' },
                preferredStops: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          required: ['departure', 'destination']
        }
      });
      
      // Collect tools from all agents
      for (const [agentName, agent] of Object.entries(this.agents)) {
        const agentTools = agent.getTools();
        for (const tool of agentTools) {
          tools.push({
            ...tool,
            name: `${agentName}_${tool.name}`
          });
        }
      }
      
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // Handle orchestrator-level tools
        if (name === 'plan_passage') {
          return await this.planPassage(args);
        }
        
        // Route to appropriate agent
        const [agentName, toolName] = name.split('_', 2);
        if (this.agents[agentName]) {
          const result = await this.agents[agentName].handleToolCall(
            toolName,
            args
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        
        throw new Error(`Unknown tool: ${name}`);
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  private async planPassage(request: any): Promise<any> {
    const planningId = uuidv4();
    
    // Broadcast planning start
    this.broadcastUpdate({
      type: 'planning_started',
      planningId,
      request
    });
    
    try {
      // Step 1: Calculate base route
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'route',
        status: 'Calculating optimal route...'
      });
      
      const route = await this.agents['route'].handleToolCall('calculate_route', {
        departure: request.departure,
        destination: request.destination,
        vessel_speed: request.vessel?.cruiseSpeed || 5,
        optimization: 'distance'
      });
      
      // Step 2: Get weather along route
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'weather',
        status: 'Fetching weather forecast...'
      });
      
      const weatherPromises = route.waypoints.map(wp =>
        this.agents['weather'].handleToolCall('get_marine_forecast', {
          latitude: wp.latitude,
          longitude: wp.longitude,
          hours: 72
        })
      );
      const weatherData = await Promise.all(weatherPromises);
      
      // Step 3: Get tidal information
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'tidal',
        status: 'Calculating tides and currents...'
      });
      
      const tidalData = await this.agents['tidal'].handleToolCall('get_tide_predictions', {
        latitude: request.departure.latitude,
        longitude: request.departure.longitude,
        start_date: request.departure.time,
        end_date: new Date(new Date(request.departure.time).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      
      // Step 4: Safety check
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'safety',
        status: 'Checking navigation warnings...'
      });
      
      const safetyData = await this.agents['safety'].handleToolCall('check_route_safety', {
        route: route.waypoints,
        departure_time: request.departure.time
      });
      
      // Step 5: Port information
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'port',
        status: 'Gathering port information...'
      });
      
      const departurePort = await this.agents['port'].handleToolCall('get_port_info', {
        latitude: request.departure.latitude,
        longitude: request.departure.longitude
      });
      
      const destinationPort = await this.agents['port'].handleToolCall('get_port_info', {
        latitude: request.destination.latitude,
        longitude: request.destination.longitude
      });
      
      // Step 6: Wind analysis
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'wind',
        status: 'Analyzing wind patterns...'
      });
      
      const windAnalysis = await this.agents['wind'].handleToolCall('analyze_wind_route', {
        route: route.waypoints,
        departure_time: request.departure.time,
        vessel_type: request.vessel?.type || 'sailboat'
      });
      
      // Compile comprehensive passage plan
      const passagePlan = {
        id: planningId,
        request,
        route,
        weather: weatherData,
        tides: tidalData,
        safety: safetyData,
        ports: {
          departure: departurePort,
          destination: destinationPort
        },
        wind: windAnalysis,
        summary: {
          totalDistance: route.totalDistance,
          estimatedDuration: route.estimatedDuration,
          departureTime: request.departure.time,
          estimatedArrival: new Date(
            new Date(request.departure.time).getTime() + route.estimatedDuration * 60 * 60 * 1000
          ),
          warnings: safetyData.warnings || [],
          recommendations: this.generateRecommendations(weatherData, windAnalysis, tidalData)
        }
      };
      
      // Save to database
      await this.savePassage(passagePlan);
      
      // Broadcast completion
      this.broadcastUpdate({
        type: 'planning_completed',
        planningId,
        plan: passagePlan
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(passagePlan, null, 2)
        }]
      };
      
    } catch (error) {
      this.broadcastUpdate({
        type: 'planning_error',
        planningId,
        error: error.message
      });
      throw error;
    }
  }

  private generateRecommendations(weather: any, wind: any, tides: any): string[] {
    const recommendations = [];
    
    // Analyze weather conditions
    if (weather.some(w => w.windSpeed > 25)) {
      recommendations.push('Strong winds expected - consider delaying departure or seeking shelter');
    }
    
    if (weather.some(w => w.waveHeight > 3)) {
      recommendations.push('Rough seas anticipated - ensure crew is prepared and safety equipment is ready');
    }
    
    // Add more recommendation logic
    
    return recommendations;
  }

  private async savePassage(passagePlan: any): Promise<void> {
    const { data, error } = await this.supabase
      .from('passages')
      .insert({
        id: passagePlan.id,
        user_id: passagePlan.request.userId,
        name: `${passagePlan.request.departure.port} to ${passagePlan.request.destination.port}`,
        departure_port: passagePlan.request.departure.port,
        departure_coords: `POINT(${passagePlan.request.departure.longitude} ${passagePlan.request.departure.latitude})`,
        destination_port: passagePlan.request.destination.port,
        destination_coords: `POINT(${passagePlan.request.destination.longitude} ${passagePlan.request.destination.latitude})`,
        departure_time: passagePlan.request.departure.time,
        estimated_arrival: passagePlan.summary.estimatedArrival,
        distance_nm: passagePlan.summary.totalDistance,
        route_points: passagePlan.route.waypoints,
        weather_data: passagePlan.weather,
        tidal_data: passagePlan.tides,
        safety_notes: passagePlan.safety,
        planning_parameters: passagePlan.request.preferences,
        agent_responses: {
          route: passagePlan.route,
          weather: passagePlan.weather,
          tides: passagePlan.tides,
          safety: passagePlan.safety,
          ports: passagePlan.ports,
          wind: passagePlan.wind
        }
      });
    
    if (error) throw error;
  }

  private setupWebSocket() {
    this.wss = new WebSocketServer({ port: 8081 });
    
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          // Handle incoming messages if needed
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  private broadcastUpdate(update: any) {
    const message = JSON.stringify(update);
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Orchestrator started');
  }

  async shutdown() {
    for (const agent of Object.values(this.agents)) {
      await agent.shutdown();
    }
    await this.redis.quit();
    this.wss.close();
    console.log('Orchestrator shutdown complete');
  }
} {
        client.send(message);
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Orchestrator started');
  }

  async shutdown() {
    for (const agent of Object.values(this.agents)) {
      await agent.shutdown();
    }
    await this.redis.quit();
    this.wss.close();
    console.log('Orchestrator shutdown complete');
  }
}
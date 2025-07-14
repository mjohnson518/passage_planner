'use client'

import { useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, PassagePlan, AgentStatus } from '@/app/types';

interface UsePassagePlannerReturn {
  messages: Message[];
  isProcessing: boolean;
  activeAgents: AgentStatus[];
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export function usePassagePlanner(): UsePassagePlannerReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgents, setActiveAgents] = useState<AgentStatus[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize WebSocket connection
  useState(() => {
    const ws = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080', {
      transports: ['websocket'],
    });

    ws.on('connect', () => {
      console.log('Connected to orchestrator');
    });

    ws.on('agents:status', (data: { agents: AgentStatus[] }) => {
      setActiveAgents(data.agents);
    });

    ws.on('processing:update', (update: any) => {
      setMessages(prev => [...prev, {
        id: `update-${Date.now()}`,
        role: 'system',
        content: `${update.stage}: ${update.message}`,
        timestamp: new Date(),
      }]);
    });

    ws.on('plan:complete', (plan: PassagePlan) => {
      setMessages(prev => [...prev, {
        id: `plan-${plan.id}`,
        role: 'assistant',
        content: formatPassagePlan(plan),
        timestamp: new Date(),
        data: plan,
      }]);
      setIsProcessing(false);
    });

    setSocket(ws);

    return () => {
      ws.disconnect();
    };
  });

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Parse the message to extract passage planning details
      const planDetails = parseMessageForPlan(content);
      
      // Send to API
      const response = await fetch('/api/passage/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planDetails),
      });

      if (!response.ok) {
        throw new Error('Failed to plan passage');
      }

      // The response will be handled by the WebSocket events
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
      setIsProcessing(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isProcessing,
    activeAgents,
    sendMessage,
    clearMessages,
  };
}

// Helper function to parse natural language into plan details
function parseMessageForPlan(message: string): any {
  // Simple parsing logic - in production, this would use NLP
  const lowerMessage = message.toLowerCase();
  
  // Extract departure and destination
  const fromMatch = message.match(/from\s+([^to]+)\s+to/i);
  const toMatch = message.match(/to\s+([^on|at|departing]+)/i);
  
  // Extract date/time
  const dateMatch = message.match(/on\s+(\d{4}-\d{2}-\d{2})/i);
  const timeMatch = message.match(/at\s+(\d{1,2}:\d{2})/i);
  
  const departure = fromMatch ? fromMatch[1].trim() : 'Boston, MA';
  const destination = toMatch ? toMatch[1].trim() : 'Portland, ME';
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  const time = timeMatch ? timeMatch[1] : '10:00';
  
  return {
    departure,
    destination,
    departureTime: `${date}T${time}:00Z`,
    boatType: lowerMessage.includes('sail') ? 'sailboat' : 
              lowerMessage.includes('power') ? 'powerboat' : 
              'sailboat',
    preferences: {
      avoidNightSailing: lowerMessage.includes('avoid night'),
      maxWindSpeed: 25,
      maxWaveHeight: 2,
    },
  };
}

// Helper function to format passage plan for display
function formatPassagePlan(plan: PassagePlan): string {
  return `# Passage Plan: ${plan.departure.name} to ${plan.destination.name}

## Summary
- **Distance**: ${plan.distance.total} ${plan.distance.unit}
- **Departure**: ${new Date(plan.departureTime).toLocaleString()}
- **Estimated Arrival**: ${new Date(plan.estimatedArrivalTime).toLocaleString()}

## Waypoints
${plan.waypoints.map((wp, i) => `${i + 1}. ${wp.name || `Waypoint ${i + 1}`} (${wp.coordinates.latitude.toFixed(4)}°, ${wp.coordinates.longitude.toFixed(4)}°)`).join('\n')}

## Weather Forecast
${plan.weather.conditions.map(c => `- ${c.description}, Wind: ${c.windDirection} ${c.windSpeed}kt, Waves: ${c.waveHeight}ft`).join('\n')}

## Tidal Information
${plan.tides.map(t => `**${t.location}**: ${t.predictions.map(p => `${p.type} tide at ${new Date(p.time).toLocaleTimeString()}`).join(', ')}`).join('\n')}

## Safety Information
- **Required Equipment**: ${plan.safety.requiredEquipment.join(', ')}
- **Emergency Contacts**: ${plan.safety.emergencyContacts.map(c => `${c.type}: ${c.phone || c.vhfChannel ? `VHF ${c.vhfChannel}` : 'N/A'}`).join(', ')}
`;
} 
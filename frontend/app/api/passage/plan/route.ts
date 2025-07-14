import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // For now, return a mock response
    const mockResponse = {
      id: `plan-${Date.now()}`,
      departure: {
        name: body.departure,
        coordinates: { latitude: 42.3601, longitude: -71.0589 },
        country: 'US',
        facilities: [],
        contacts: []
      },
      destination: {
        name: body.destination,
        coordinates: { latitude: 43.6591, longitude: -70.2568 },
        country: 'US',
        facilities: [],
        contacts: []
      },
      waypoints: [
        {
          id: 'wp1',
          name: 'Cape Ann',
          coordinates: { latitude: 42.6306, longitude: -70.6251 },
          estimatedArrival: new Date(Date.now() + 3600000).toISOString()
        },
        {
          id: 'wp2',
          name: 'Portsmouth',
          coordinates: { latitude: 43.0718, longitude: -70.7626 },
          estimatedArrival: new Date(Date.now() + 7200000).toISOString()
        }
      ],
      departureTime: body.departureTime || new Date().toISOString(),
      estimatedArrivalTime: new Date(Date.now() + 14400000).toISOString(),
      distance: {
        total: 105,
        unit: 'nm'
      },
      weather: {
        conditions: [
          {
            timeWindow: {
              start: new Date().toISOString(),
              end: new Date(Date.now() + 86400000).toISOString()
            },
            description: 'Fair weather with light winds',
            windSpeed: 10,
            windDirection: 'NW',
            waveHeight: 2,
            visibility: 10,
            precipitation: 0
          }
        ],
        warnings: [],
        lastUpdated: new Date().toISOString()
      },
      tides: [
        {
          location: body.departure,
          predictions: [
            {
              time: new Date(Date.now() + 21600000).toISOString(),
              height: 9.5,
              type: 'high' as const
            },
            {
              time: new Date(Date.now() + 43200000).toISOString(),
              height: 1.2,
              type: 'low' as const
            }
          ]
        }
      ],
      safety: {
        emergencyContacts: [
          {
            type: 'harbormaster' as const,
            name: 'Boston Harbor Master',
            phone: '+1-617-555-0123',
            vhfChannel: 16
          },
          {
            type: 'emergency' as const,
            name: 'USCG Sector Boston',
            phone: '+1-617-555-0911',
            vhfChannel: 16
          }
        ],
        hazards: [],
        requiredEquipment: ['Life jackets', 'Flares', 'VHF Radio', 'First aid kit'],
        weatherWindows: [
          {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 86400000).toISOString()
          }
        ]
      }
    };
    
    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error('Error in passage planning API:', error);
    return NextResponse.json(
      { error: 'Failed to plan passage' },
      { status: 500 }
    );
  }
} 
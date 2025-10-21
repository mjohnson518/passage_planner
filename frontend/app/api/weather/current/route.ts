export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const headersList = headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { location, coordinates } = body
    
    // Forward to orchestrator's weather service
    const response = await fetch(`${process.env.ORCHESTRATOR_URL || 'http://localhost:8080'}/api/weather/current`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      body: JSON.stringify({ location, coordinates })
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const weatherData = await response.json()
    return NextResponse.json(weatherData)
  } catch (error) {
    console.error('Failed to fetch weather data:', error)
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 })
  }
}

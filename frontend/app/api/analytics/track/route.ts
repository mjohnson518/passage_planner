export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const headersList = headers()
    
    // Get user info from auth header if available
    const authorization = headersList.get('authorization')
    
    // Forward the analytics event to the orchestrator
    const response = await fetch(`${process.env.ORCHESTRATOR_URL || 'http://localhost:8080'}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization && { 'Authorization': authorization })
      },
      body: JSON.stringify({
        ...body,
        // Add server-side data
        serverTimestamp: new Date().toISOString(),
        ip: headersList.get('x-forwarded-for') || headersList.get('x-real-ip'),
        userAgent: headersList.get('user-agent'),
      })
    })

    if (!response.ok) {
      throw new Error('Failed to track event')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics tracking error:', error)
    // Don't fail the request if analytics fails
    return NextResponse.json({ success: false, error: 'Tracking failed' }, { status: 200 })
  }
} 
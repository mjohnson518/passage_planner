export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  try {
    const headersList = headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward to orchestrator with custom endpoint for dashboard stats
    const response = await fetch(`${process.env.ORCHESTRATOR_URL || 'http://localhost:8080'}/api/dashboard/stats`, {
      headers: {
        'Authorization': authorization
      }
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const stats = await response.json()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}

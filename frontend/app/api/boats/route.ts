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

    // Forward to orchestrator
    const response = await fetch(`${process.env.ORCHESTRATOR_URL || 'http://localhost:8080'}/api/boats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const boat = await response.json()
    return NextResponse.json(boat)
  } catch (error) {
    console.error('Failed to create boat profile:', error)
    return NextResponse.json({ error: 'Failed to create boat profile' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const headersList = headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward to orchestrator
    const response = await fetch(`${process.env.ORCHESTRATOR_URL || 'http://localhost:8080'}/api/boats`, {
      headers: {
        'Authorization': authorization
      }
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const boats = await response.json()
    return NextResponse.json(boats)
  } catch (error) {
    console.error('Failed to fetch boat profiles:', error)
    return NextResponse.json({ error: 'Failed to fetch boat profiles' }, { status: 500 })
  }
} 
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  try {
    const headersList = headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward to orchestrator
    const response = await fetch(`${process.env.ORCHESTRATOR_URL || 'http://localhost:8080'}/api/passages`, {
      headers: {
        'Authorization': authorization
      }
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const passages = await response.json()
    return NextResponse.json(passages)
  } catch (error) {
    console.error('Failed to fetch passages:', error)
    return NextResponse.json({ error: 'Failed to fetch passages' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const headersList = headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward to orchestrator
    const response = await fetch(`${process.env.ORCHESTRATOR_URL || 'http://localhost:8080'}/api/passages`, {
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

    const passage = await response.json()
    return NextResponse.json(passage)
  } catch (error) {
    console.error('Failed to create passage:', error)
    return NextResponse.json({ error: 'Failed to create passage' }, { status: 500 })
  }
}

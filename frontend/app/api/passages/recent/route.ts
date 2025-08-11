import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  try {
    const headersList = headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward to orchestrator with query params for recent passages
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') || '5'
    
    const response = await fetch(
      `${process.env.ORCHESTRATOR_URL || 'http://localhost:8080'}/api/passages/recent?limit=${limit}`,
      {
        headers: {
          'Authorization': authorization
        }
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const passages = await response.json()
    return NextResponse.json(passages)
  } catch (error) {
    console.error('Failed to fetch recent passages:', error)
    return NextResponse.json({ error: 'Failed to fetch recent passages' }, { status: 500 })
  }
}

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * Create Stripe Customer Portal session for managing subscriptions
 * 
 * TODO: Backend endpoint needs to be implemented at:
 * POST /api/subscription/customer-portal
 * 
 * This allows users to:
 * - Update payment methods
 * - Cancel subscriptions
 * - View billing history
 * - Download invoices
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    if (!authorization) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse optional return URL
    const body = await request.json().catch(() => ({}))
    const { returnUrl } = body

    // Call orchestrator to create customer portal session
    const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || process.env.ORCHESTRATOR_URL || 'http://localhost:8080'
    
    const response = await fetch(`${orchestratorUrl}/api/subscription/customer-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      body: JSON.stringify({
        returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/profile`
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Orchestrator customer portal creation failed:', errorData)
      
      // If endpoint doesn't exist yet, return helpful message
      if (response.status === 404) {
        return NextResponse.json(
          { 
            error: 'Customer portal not yet implemented',
            message: 'Please contact support to manage your subscription'
          },
          { status: 501 }
        )
      }
      
      return NextResponse.json(
        { error: errorData.error || 'Failed to create customer portal session' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      url: data.url,
      success: true
    })
  } catch (error) {
    console.error('Customer portal creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


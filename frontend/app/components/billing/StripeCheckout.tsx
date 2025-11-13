'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Alert, AlertDescription } from '../ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface StripeCheckoutProps {
  tier: 'premium' | 'pro'
  period: 'monthly' | 'yearly'
  priceId?: string  // Optional: for display/tracking purposes
  onSuccess?: () => void
  onCancel?: () => void
}

export default function StripeCheckout({ 
  tier,
  period,
  priceId,
  onSuccess,
  onCancel 
}: StripeCheckoutProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get auth token from localStorage (or use cookie-based auth)
      const authToken = localStorage.getItem('auth_token')
      
      if (!authToken) {
        setError('You must be logged in to subscribe')
        toast.error('Please log in to continue')
        return
      }

      // Call our API route to create Stripe checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tier,
          period,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/pricing?payment=cancelled`
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      if (!url) {
        throw new Error('No checkout URL received')
      }

      // Track checkout initiation
      console.log('Redirecting to Stripe checkout:', { tier, period, priceId })

      // Redirect to Stripe checkout
      window.location.href = url
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Checkout error:', err)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Purchase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          You'll be redirected to our secure payment processor (Stripe) to complete your {tier} {period} subscription.
        </p>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleCheckout}
            disabled={loading}
            className="min-w-[180px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              'Proceed to Checkout'
            )}
          </Button>
          {onCancel && (
            <Button 
              variant="outline" 
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          🔒 Secure payment powered by Stripe
        </p>
      </CardContent>
    </Card>
  )
} 
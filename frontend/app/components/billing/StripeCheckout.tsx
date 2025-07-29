'use client'

import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface StripeCheckoutProps {
  priceId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function StripeCheckout({ 
  priceId, 
  onSuccess,
  onCancel 
}: StripeCheckoutProps) {
  const handleCheckout = async () => {
    try {
      // TODO: Implement Stripe checkout
      // 1. Call /api/subscription/create-checkout-session
      // 2. Redirect to Stripe checkout
      console.log('Checkout with price:', priceId)
    } catch (error) {
      console.error('Checkout error:', error)
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Purchase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          You'll be redirected to our secure payment processor.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleCheckout}>
            Proceed to Checkout
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 
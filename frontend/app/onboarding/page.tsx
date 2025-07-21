'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow'
import { useAnalytics } from '../hooks/useAnalytics'

export default function OnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { track } = useAnalytics()

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Track onboarding start
    track('onboarding_started', {
      userId: user.id,
      email: user.email
    })
  }, [user, router, track])

  if (!user) {
    return null
  }

  return <OnboardingFlow />
} 
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import { WelcomeStep } from './steps/WelcomeStep'
import { BoatSetupStep } from './steps/BoatSetupStep'
import { PreferencesStep } from './steps/PreferencesStep'
import { TutorialStep } from './steps/TutorialStep'
import { CompletionStep } from './steps/CompletionStep'
import { useAuth } from '../../contexts/AuthContext'
import { useAnalytics } from '../../hooks/useAnalytics'
import { ANALYTICS_EVENTS } from '../../hooks/useAnalytics'
import type { BoatProfile, PassagePreferences } from '../../../../shared/src/types/boat'

export interface OnboardingData {
  boat: Partial<BoatProfile>
  preferences: Partial<PassagePreferences>
}

const TOTAL_STEPS = 5

export function OnboardingFlow() {
  const router = useRouter()
  const { user } = useAuth()
  const { track } = useAnalytics()
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    boat: {
      type: 'sailboat',
      length: 35,
      draft: 5,
      isDefault: true
    },
    preferences: {
      maxWindSpeed: 25,
      maxWaveHeight: 2,
      avoidNight: true,
      comfortLevel: 'cruising'
    }
  })

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({
      ...prev,
      ...updates
    }))
  }

  const handleNext = () => {
    track('onboarding_step_completed', { 
      step: currentStep, 
      stepName: getStepName(currentStep) 
    })
    
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleComplete = async () => {
    try {
      // Save boat profile
      const boatResponse = await fetch('/api/boats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          ...data.boat,
          userId: user?.id,
          defaultPreferences: data.preferences
        })
      })

      if (!boatResponse.ok) {
        throw new Error('Failed to save boat profile')
      }

      // Track completion
      track(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
        boatType: data.boat.type,
        boatLength: data.boat.length,
        hasPreferences: !!data.preferences
      })

      // Navigate to dashboard
      router.push('/dashboard?onboarding=complete')
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      // Still navigate to dashboard even if save fails
      router.push('/dashboard')
    }
  }

  const handleSkip = () => {
    track('onboarding_skipped', { step: currentStep })
    router.push('/dashboard')
  }

  const getStepName = (step: number) => {
    const steps = ['welcome', 'boat_setup', 'preferences', 'tutorial', 'completion']
    return steps[step] || 'unknown'
  }

  const steps = [
    <WelcomeStep key="welcome" onNext={handleNext} />,
    <BoatSetupStep 
      key="boat" 
      data={data.boat} 
      onUpdate={(boat) => updateData({ boat })}
      onNext={handleNext}
      onPrevious={handlePrevious}
    />,
    <PreferencesStep
      key="preferences"
      data={data.preferences}
      boatType={data.boat.type}
      onUpdate={(preferences) => updateData({ preferences })}
      onNext={handleNext}
      onPrevious={handlePrevious}
    />,
    <TutorialStep
      key="tutorial"
      onNext={handleNext}
      onPrevious={handlePrevious}
    />,
    <CompletionStep
      key="completion"
      data={data}
      onComplete={handleComplete}
      onPrevious={handlePrevious}
    />
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">Welcome to Helmwise</h1>
            {currentStep < TOTAL_STEPS - 1 && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                Skip for now
              </Button>
            )}
          </div>
          
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={(currentStep + 1) / TOTAL_STEPS * 100} />
            <p className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {TOTAL_STEPS}
            </p>
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {steps[currentStep]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
} 
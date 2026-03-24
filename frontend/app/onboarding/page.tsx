'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { WelcomeStep } from '../components/onboarding/steps/WelcomeStep'
import { BoatSetupStep } from '../components/onboarding/steps/BoatSetupStep'
import { PreferencesStep } from '../components/onboarding/steps/PreferencesStep'
import { TutorialStep } from '../components/onboarding/steps/TutorialStep'
import { CompletionStep } from '../components/onboarding/steps/CompletionStep'
import { Progress } from '../components/ui/progress'
import { Button } from '../components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface OnboardingData {
  boatName?: string
  boatType?: 'sailboat' | 'powerboat' | 'catamaran'
  boatLength?: number
  sailingExperience?: 'beginner' | 'intermediate' | 'advanced' | 'professional'
  homePort?: string
  preferences: {
    avoidNightSailing: boolean
    maxWindSpeed: number
    maxWaveHeight: number
    notificationPreferences: {
      weatherAlerts: boolean
      passageReminders: boolean
      safetyUpdates: boolean
      marketing: boolean
    }
  }
}

export default function OnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    preferences: {
      avoidNightSailing: false,
      maxWindSpeed: 25,
      maxWaveHeight: 6,
      notificationPreferences: {
        weatherAlerts: true,
        passageReminders: true,
        safetyUpdates: true,
        marketing: false,
      }
    }
  })

  const steps = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'boat', title: 'Your Boat' },
    { id: 'preferences', title: 'Preferences' },
    { id: 'tutorial', title: 'Quick Tour' },
    { id: 'completion', title: 'All Set!' },
  ]

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    try {
      // Save onboarding data to profile
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sailing_experience: onboardingData.sailingExperience,
          boat_type: onboardingData.boatType,
          boat_name: onboardingData.boatName,
          boat_length: onboardingData.boatLength,
          home_port: onboardingData.homePort,
          preferences: onboardingData.preferences,
          onboarding_completed: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      // Track onboarding completion
      await fetch('/api/analytics/track', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'onboarding_completed',
          properties: {
            sailing_experience: onboardingData.sailingExperience,
            boat_type: onboardingData.boatType,
          },
        }),
      })

      toast.success('Welcome aboard! Your profile has been set up.')
      router.push('/dashboard')
    } catch (error) {
      toast.error('Failed to complete onboarding. Please try again.')
    }
  }

  const handleSkip = async () => {
    try {
      // Mark onboarding as skipped
      await fetch('/api/user/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          onboarding_completed: true,
          onboarding_skipped: true,
        }),
      })

      router.push('/dashboard')
    } catch (error) {
      router.push('/dashboard')
    }
  }

  const updateData = (data: Partial<OnboardingData>) => {
    setOnboardingData({ ...onboardingData, ...data })
  }

  const progressPercentage = ((currentStep + 1) / steps.length) * 100

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Step content */}
          <div className="bg-card rounded-lg shadow-maritime p-8 border border-border">
            {currentStep === 0 && (
              <WelcomeStep 
                userName={(user as any)?.display_name || (user as any)?.user_metadata?.display_name || user.email?.split('@')[0] || 'Sailor'}
              />
            )}
            
            {currentStep === 1 && (
              <BoatSetupStep
                data={onboardingData}
                onUpdate={updateData}
              />
            )}
            
            {currentStep === 2 && (
              <PreferencesStep
                data={onboardingData}
                onUpdate={updateData}
              />
            )}
            
            {currentStep === 3 && (
              <TutorialStep />
            )}
            
            {currentStep === 4 && (
              <CompletionStep
                data={onboardingData}
              />
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                onClick={handleNext}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                className="flex items-center gap-2"
              >
                Start Planning
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 
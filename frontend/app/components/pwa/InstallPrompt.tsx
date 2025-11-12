'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Download, X } from 'lucide-react'

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Show prompt after a delay
      setTimeout(() => {
        if (!localStorage.getItem('pwa-prompt-dismissed')) {
          setShowPrompt(true)
        }
      }, 30000) // Show after 30 seconds
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // iOS doesn't support beforeinstallprompt, show custom prompt
    if (isIOSDevice && !localStorage.getItem('pwa-prompt-dismissed-ios')) {
      setTimeout(() => {
        setShowPrompt(true)
      }, 30000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('PWA installed')
    }

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem(isIOS ? 'pwa-prompt-dismissed-ios' : 'pwa-prompt-dismissed', 'true')
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96">
      <Card className="shadow-lg border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Install Helmwise</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {isIOS 
                  ? 'Add to your home screen for quick access and offline features'
                  : 'Install our app for the best experience with offline access'
                }
              </p>
              
              {isIOS ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>1. Tap the share button <span className="inline-block w-4 h-4 align-middle">⬆️</span></p>
                  <p>2. Scroll down and tap "Add to Home Screen"</p>
                  <p>3. Tap "Add" to install</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleInstall}>
                    Install App
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss}>
                    Not Now
                  </Button>
                </div>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
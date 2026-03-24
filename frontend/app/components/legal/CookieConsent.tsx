'use client'

import { useState, useEffect } from 'react'

const CONSENT_KEY = 'helmwise_cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (!stored) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setVisible(false)
  }

  const reject = () => {
    localStorage.setItem(CONSENT_KEY, 'rejected')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-4 py-4 shadow-lg sm:flex sm:items-center sm:gap-4"
    >
      <p className="flex-1 text-sm text-muted-foreground mb-3 sm:mb-0">
        We use essential cookies to operate this service, and optional analytics cookies to improve it.{' '}
        <a href="/cookies" className="underline hover:text-foreground">Cookie Policy</a>
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={reject}
          className="rounded border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Reject non-essential
        </button>
        <button
          onClick={accept}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Accept all
        </button>
      </div>
    </div>
  )
}

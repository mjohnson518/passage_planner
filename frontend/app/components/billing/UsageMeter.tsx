'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface UsageSummary {
  passagesThisMonth: number
  passageLimit: number
  bonusPassages: number
  apiCallsToday: number
  apiCallLimit: number
  tier: string
}

export function UsageMeter() {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/usage/summary', { credentials: 'include' })
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !summary) return null

  const isUnlimited = summary.passageLimit === -1
  const used = summary.passagesThisMonth
  const limit = summary.passageLimit
  const pct = isUnlimited ? 0 : Math.min(100, (used / limit) * 100)
  const atLimit = !isUnlimited && used >= limit && summary.bonusPassages === 0

  const barColor = isUnlimited
    ? 'bg-success'
    : pct >= 100
    ? 'bg-destructive'
    : pct >= 80
    ? 'bg-warning'
    : 'bg-primary'

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Passages this month</span>
        {isUnlimited ? (
          <span className="text-success font-medium">Unlimited</span>
        ) : (
          <span className={cn('font-medium', atLimit ? 'text-destructive' : 'text-muted-foreground')}>
            {used} / {limit}
          </span>
        )}
      </div>

      {!isUnlimited && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {summary.bonusPassages > 0 && (
        <p className="text-xs text-warning">
          +{summary.bonusPassages} bonus passage{summary.bonusPassages !== 1 ? 's' : ''} remaining
        </p>
      )}

      {atLimit && (
        <p className="text-xs text-destructive">
          Monthly limit reached.{' '}
          <Link href="/pricing" className="underline hover:no-underline">
            Buy a passage pack
          </Link>{' '}
          or{' '}
          <Link href="/pricing" className="underline hover:no-underline">
            upgrade your plan
          </Link>
          .
        </p>
      )}

      {isUnlimited && (
        <p className="text-xs text-success">
          {used} passages planned this month
        </p>
      )}
    </div>
  )
}

import * as React from 'react'
import { cn } from '@/lib/utils'

export type StatusDotStatus = 'connected' | 'warning' | 'error' | 'idle'

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusDotStatus
  /** Adds a soft halo ring matching the status color */
  pulse?: boolean
}

const dotClass: Record<StatusDotStatus, string> = {
  connected: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
  idle: 'bg-muted-foreground',
}

const ringClass: Record<StatusDotStatus, string> = {
  connected: '[box-shadow:0_0_0_3px_hsl(var(--success)/0.2)]',
  warning: '[box-shadow:0_0_0_3px_hsl(var(--warning)/0.2)]',
  error: '[box-shadow:0_0_0_3px_hsl(var(--destructive)/0.2)]',
  idle: '',
}

/**
 * Small status indicator dot for connection state, agent health, etc.
 * Uses semantic tokens so colors adapt to light/dark mode automatically.
 */
export function StatusDot({ status, pulse = false, className, ...props }: StatusDotProps) {
  return (
    <span
      aria-label={`Status: ${status}`}
      className={cn(
        'inline-block w-2 h-2 rounded-full flex-shrink-0',
        dotClass[status],
        pulse && ringClass[status],
        className
      )}
      {...props}
    />
  )
}

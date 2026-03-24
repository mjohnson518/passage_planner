import * as React from 'react'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SafetyStatus = 'go' | 'caution' | 'nogo'

export interface SafetyAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  status: SafetyStatus
  title: string
}

const statusConfig: Record<
  SafetyStatus,
  { icon: typeof CheckCircle; containerClass: string; iconClass: string; label: string }
> = {
  go: {
    icon: CheckCircle,
    containerClass: 'border-status-go bg-status-go-bg',
    iconClass: 'text-status-go',
    label: 'GO',
  },
  caution: {
    icon: AlertTriangle,
    containerClass: 'border-status-caution bg-status-caution-bg',
    iconClass: 'text-status-caution',
    label: 'CAUTION',
  },
  nogo: {
    icon: XCircle,
    containerClass: 'border-status-nogo bg-status-nogo-bg',
    iconClass: 'text-status-nogo',
    label: 'NO-GO',
  },
}

/**
 * Safety-critical alert component for GO / CAUTION / NO-GO passage decisions.
 * Uses semantic status tokens so colors remain correct in light and dark mode.
 */
export function SafetyAlert({ status, title, children, className, ...props }: SafetyAlertProps) {
  const { icon: Icon, containerClass, iconClass, label } = statusConfig[status]
  return (
    <div
      role="alert"
      className={cn('border rounded-lg p-4', containerClass, className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', iconClass)} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className={cn('font-semibold text-sm', iconClass)}>{title}</p>
          {children && <div className="mt-1 text-sm text-foreground/80">{children}</div>}
        </div>
        <span className={cn('text-xs font-mono font-bold tracking-widest flex-shrink-0', iconClass)}>
          {label}
        </span>
      </div>
    </div>
  )
}

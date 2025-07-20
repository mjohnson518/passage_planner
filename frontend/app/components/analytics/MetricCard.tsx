import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  prefix?: string
  suffix?: string
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = 'from last period',
  prefix = '',
  suffix = '',
  trend,
  loading = false
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') return <ArrowUpIcon className="h-4 w-4" />
    if (trend === 'down') return <ArrowDownIcon className="h-4 w-4" />
    return <MinusIcon className="h-4 w-4" />
  }

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600'
    if (trend === 'down') return 'text-red-600'
    return 'text-gray-600'
  }

  const getChangeColor = () => {
    if (!change) return 'text-gray-600'
    return change > 0 ? 'text-green-600' : 'text-red-600'
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
            <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold">
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </div>
            {change !== undefined && (
              <div className={cn('flex items-center text-sm', getChangeColor())}>
                {getTrendIcon()}
                <span className="ml-1">
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="ml-1 text-muted-foreground">
                  {changeLabel}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
import { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  accent?: 'ocean' | 'brass'
}

export function FeatureCard({ icon: Icon, title, description, accent = 'ocean' }: FeatureCardProps) {
  return (
    <div className="group card-hover p-6 h-full">
      {/* Icon container */}
      <div
        className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-all duration-300',
          accent === 'ocean'
            ? 'bg-ocean-50 dark:bg-ocean-900/20 text-ocean-600 dark:text-ocean-400 group-hover:bg-ocean-100 dark:group-hover:bg-ocean-900/30'
            : 'bg-brass-50 dark:bg-brass-900/20 text-brass-600 dark:text-brass-400 group-hover:bg-brass-100 dark:group-hover:bg-brass-900/30'
        )}
      >
        <Icon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
      </div>

      {/* Content */}
      <h3 className="font-display text-lg font-bold mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      {/* Decorative line at bottom */}
      <div
        className={cn(
          'mt-5 h-0.5 w-0 group-hover:w-12 transition-all duration-300 rounded-full',
          accent === 'ocean' ? 'bg-ocean-400' : 'bg-brass-400'
        )}
      />
    </div>
  )
}

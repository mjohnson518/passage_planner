import { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  accent?: 'ocean' | 'brass' | 'seafoam' | 'amber'
  dark?: boolean
}

export function FeatureCard({ icon: Icon, title, description, accent = 'ocean', dark = false }: FeatureCardProps) {
  if (dark) {
    const isAmber = accent === 'amber' || accent === 'brass'
    return (
      <div
        className={cn(
          'group relative flex flex-col p-7 h-full card-night card-glow-hover',
          isAmber && 'card-glow-hover-amber'
        )}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid rgba(255,255,255,0.07)`,
        }}
      >
        {/* Icon container */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300"
          style={{
            background: isAmber ? 'rgba(226,179,110,0.1)' : 'rgba(0,242,195,0.08)',
            border: `1px solid ${isAmber ? 'rgba(226,179,110,0.2)' : 'rgba(0,242,195,0.16)'}`,
            color: isAmber ? 'hsl(var(--amber-sail))' : 'hsl(var(--seafoam))',
          }}
        >
          <Icon className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
        </div>

        {/* Content */}
        <h3 className="font-display text-lg font-bold mb-3 text-white leading-snug">
          {title}
        </h3>
        <p className="text-sm leading-relaxed flex-grow" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {description}
        </p>

        {/* Decorative line at bottom */}
        <div
          className="mt-6 h-px w-0 group-hover:w-10 transition-all duration-500 rounded-full"
          style={{ background: isAmber ? 'hsl(var(--amber-sail))' : 'hsl(var(--seafoam))' }}
        />
      </div>
    )
  }

  return (
    <div className="group card-hover p-6 h-full">
      {/* Icon container */}
      <div
        className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-all duration-300',
          accent === 'ocean' || accent === 'seafoam'
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
          accent === 'ocean' || accent === 'seafoam' ? 'bg-ocean-400' : 'bg-brass-400'
        )}
      />
    </div>
  )
}

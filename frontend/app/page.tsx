import Link from 'next/link'
import { Button } from './components/ui/button'
import { FeatureCard } from './components/marketing/FeatureCard'
import { PricingSection } from './components/marketing/PricingSection'
import { Header } from './components/layout/Header'
import {
  Compass,
  Cloud,
  Waves,
  Map,
  Shield,
  Anchor,
  ArrowRight,
  Navigation,
  Zap,
  BarChart3,
  Clock,
  CheckCircle
} from 'lucide-react'

// Decorative compass SVG component
function CompassRose({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      {/* Cardinal directions */}
      <path d="M100 5 L103 40 L100 35 L97 40 Z" fill="currentColor" opacity="0.6" />
      <path d="M100 195 L103 160 L100 165 L97 160 Z" fill="currentColor" opacity="0.3" />
      <path d="M5 100 L40 103 L35 100 L40 97 Z" fill="currentColor" opacity="0.3" />
      <path d="M195 100 L160 103 L165 100 L160 97 Z" fill="currentColor" opacity="0.3" />
      {/* Intercardinal */}
      <path d="M30 30 L55 55" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <path d="M170 30 L145 55" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <path d="M30 170 L55 145" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <path d="M170 170 L145 145" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <circle cx="100" cy="100" r="5" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

// Animated wave decoration
function WaveDecoration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 120"
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d="M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60 L1200,120 L0,120 Z"
        fill="currentColor"
        opacity="0.08"
      />
      <path
        d="M0,80 C200,140 400,20 600,80 C800,140 1000,20 1200,80 L1200,120 L0,120 Z"
        fill="currentColor"
        opacity="0.05"
      />
    </svg>
  )
}

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Helmwise',
    url: 'https://helmwise.co',
    description: 'AI-powered maritime passage planning for safer voyages.',
    sameAs: [],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      {/* Hero Section — Night Watch */}
      <section className="section-night-hero relative min-h-[92vh] flex items-center px-4 py-28 sm:px-6 lg:px-8">
        {/* Subtle nautical grid overlay */}
        <div className="absolute inset-0 chart-grid opacity-[0.08]" />
        {/* Faint compass rose */}
        <CompassRose className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] text-white opacity-[0.03] -mr-52 hidden lg:block" />

        <div className="relative mx-auto max-w-7xl w-full">
          <div className="grid lg:grid-cols-[1fr_420px] gap-16 lg:gap-24 items-center">
            {/* Left column */}
            <div className="text-center lg:text-left animate-fade-in-up">
              {/* Live eyebrow pill */}
              <div className="inline-flex items-center gap-3 mb-8 justify-center lg:justify-start">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 pulse-live" />
                <span className="eyebrow-night">AI-Powered Passage Planning</span>
              </div>

              <h1 className="font-display text-white text-balance leading-[1.05] tracking-tight">
                Navigate with
                <br />
                <span style={{ color: 'hsl(var(--seafoam))' }}>Confidence</span>
              </h1>

              <p className="mt-7 text-lg lg:text-xl max-w-xl mx-auto lg:mx-0 text-balance" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Helmwise orchestrates specialized AI agents to deliver comprehensive passage plans with real-time weather, tidal predictions, and safety analysis.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Link href="/signup">
                  <Button data-testid="hero-cta-signup" size="lg" className="btn-seafoam group">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button data-testid="hero-cta-demo" size="lg" className="btn-night-outline">
                    View Demo
                  </Button>
                </Link>
              </div>

              {/* Platform highlights */}
              <div className="mt-12 flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--seafoam))' }} />
                  <span>Safety-first passage planning</span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--seafoam))' }} />
                  <span>70+ ports covered</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--seafoam))' }} />
                  <span>6 AI agents in parallel</span>
                </div>
              </div>
            </div>

            {/* Right column — Glass Passage Plan Card */}
            <div className="relative hidden lg:block">
              <div className="relative">
                {/* Main glassmorphism card */}
                <div className="glass-night p-7 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display text-white text-lg">Passage Plan</h3>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                      style={{
                        background: 'rgba(0,242,195,0.12)',
                        color: 'hsl(var(--seafoam))',
                        border: '1px solid rgba(0,242,195,0.25)',
                      }}
                    >
                      <CheckCircle className="h-3 w-3" />
                      GO
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Route */}
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <Navigation className="h-5 w-5 flex-shrink-0" style={{ color: 'hsl(var(--seafoam))' }} />
                      <div>
                        <p className="text-sm font-medium text-white">Miami, FL → Nassau, Bahamas</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>184nm · Est. 28h</p>
                      </div>
                    </div>

                    {/* Conditions grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: Cloud, label: 'Weather', value: 'Clear' },
                        { icon: Waves, label: 'Seas', value: '2–4ft' },
                        { icon: Compass, label: 'Wind', value: '12kt SE' },
                      ].map(({ icon: Icon, label, value }) => (
                        <div
                          key={label}
                          className="p-3 rounded-lg text-center"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: 'rgba(255,255,255,0.35)' }} />
                          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Safety status */}
                    <div
                      className="flex items-center gap-2.5 p-3 rounded-lg text-sm"
                      style={{ background: 'rgba(0,242,195,0.06)', border: '1px solid rgba(0,242,195,0.14)' }}
                    >
                      <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--seafoam))' }} />
                      <span style={{ color: 'hsl(var(--seafoam))' }}>All safety checks passed</span>
                    </div>
                  </div>
                </div>

                {/* Floating agent status pill */}
                <div
                  className="absolute -right-5 -bottom-5 animate-float"
                  style={{ animationDelay: '0.5s' }}
                >
                  <div
                    className="glass-night px-4 py-3 flex items-center gap-3"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                  >
                    <div className="relative">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, rgba(0,242,195,0.2), rgba(0,242,195,0.05))',
                          border: '1px solid rgba(0,242,195,0.25)',
                        }}
                      >
                        <Zap className="h-4 w-4" style={{ color: 'hsl(var(--seafoam))' }} />
                      </div>
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full pulse-live"
                        style={{ border: '2px solid #0A1120' }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-none">6 Agents Active</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Processing in parallel</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave fade to next section */}
        <div className="absolute bottom-0 left-0 right-0 w-full h-20" style={{ opacity: 0.04 }}>
          <WaveDecoration className="w-full h-full text-white" />
        </div>
      </section>

      {/* Platform Capabilities Section */}
      <section className="relative px-4 py-16 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '6', label: 'Specialized AI Agents', icon: Zap },
              { value: '70+', label: 'Ports Covered', icon: Map },
              { value: '<30s', label: 'Avg. Plan Time', icon: Clock },
              { value: '5', label: 'Data Sources Integrated', icon: BarChart3 },
            ].map((stat, i) => (
              <div key={i} className="group">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                  <stat.icon className="h-6 w-6" />
                </div>
                <p className="text-3xl font-display font-bold text-gradient">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="absolute inset-0 chart-grid-dense opacity-20" />

        <div className="relative mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <span className="badge-brass mb-4">Capabilities</span>
            <h2 className="font-display mt-4">
              Everything for Safe Passage Planning
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Six specialized AI agents work together to analyze conditions and optimize your route
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 stagger-fade-in">
            <FeatureCard
              icon={Cloud}
              title="Weather Routing"
              description="Real-time NOAA forecasts with storm tracking, wind analysis, and optimal departure windows"
              accent="ocean"
            />
            <FeatureCard
              icon={Waves}
              title="Tidal Analysis"
              description="Precise tide and current predictions from official NOAA stations along your route"
              accent="ocean"
            />
            <FeatureCard
              icon={Map}
              title="Route Optimization"
              description="AI-calculated waypoints considering weather windows, currents, and hazards"
              accent="brass"
            />
            <FeatureCard
              icon={Anchor}
              title="Port Intelligence"
              description="Comprehensive marina data, facilities, entry requirements, and emergency contacts"
              accent="ocean"
            />
            <FeatureCard
              icon={Shield}
              title="Safety Briefings"
              description="Automated risk assessment, USCG warnings, and emergency harbor identification"
              accent="brass"
            />
            <FeatureCard
              icon={Compass}
              title="Navigation Warnings"
              description="Live NAVTEX alerts, restricted zones, and Notice to Mariners for your route"
              accent="ocean"
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="section-alt px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <span className="badge-primary mb-4">Process</span>
            <h2 className="font-display mt-4">
              Plan Your Passage in Minutes
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              From ports to comprehensive plan in three simple steps
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Enter Your Route',
                description: 'Select departure and destination ports, add waypoints, and set your departure time.',
                icon: Map,
              },
              {
                step: '02',
                title: 'AI Analysis',
                description: 'Six specialized agents analyze weather, tides, hazards, and safety factors simultaneously.',
                icon: Zap,
              },
              {
                step: '03',
                title: 'Get Your Plan',
                description: 'Receive a comprehensive passage plan with GO/NO-GO decision, waypoints, and export options.',
                icon: CheckCircle,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="relative group"
              >
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden lg:block absolute top-16 left-[60%] w-full h-[2px] bg-gradient-to-r from-primary/30 to-transparent" />
                )}

                <div className="card-hover p-8 h-full">
                  <div className="flex items-start gap-4 mb-6">
                    <span className="text-5xl font-display font-bold text-gradient-brass opacity-50">
                      {item.step}
                    </span>
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <item.icon className="h-7 w-7" />
                    </div>
                  </div>
                  <h3 className="font-display text-xl mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="section-ocean px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="relative mx-auto max-w-4xl text-center">
          <h2 className="font-display text-primary-foreground">
            Ready to Navigate Smarter?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            Experience AI-powered passage planning with real-time weather, tidal analysis, and comprehensive safety briefings. Start your free trial today.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="btn-brass group">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Talk to Sales
              </Button>
            </Link>
          </div>

          <p className="mt-8 text-sm text-primary-foreground/60">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer data-testid="footer" className="px-4 py-12 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Anchor className="h-6 w-6 text-primary" />
                <span className="font-display text-lg font-bold">Helmwise</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered passage planning for modern sailors. Navigate with confidence.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-primary transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-primary transition-colors">Documentation</Link></li>
                <li><Link href="/changelog" className="hover:text-primary transition-colors">Changelog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-primary transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Helmwise. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://twitter.com/helmwise" className="text-muted-foreground hover:text-primary transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/></svg>
              </a>
              <a href="https://github.com/helmwise" className="text-muted-foreground hover:text-primary transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/></svg>
              </a>
              <a href="https://linkedin.com/company/helmwise" className="text-muted-foreground hover:text-primary transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

import Link from 'next/link'
import { Button } from './components/ui/button'
import { FeatureCard } from './components/marketing/FeatureCard'
import { PricingSection } from './components/marketing/PricingSection'
import { Header } from './components/layout/Header'
import { ParticleGrid } from './components/marketing/ParticleGrid'
import {
  Compass,
  Cloud,
  Waves,
  Map,
  Shield,
  Anchor,
  ArrowRight,
  Navigation,
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
      <section className="section-night-hero relative min-h-screen flex items-center px-4 py-28 sm:px-6 lg:px-8">
        {/* Interactive particle grid — scoped to hero */}
        <ParticleGrid />
        {/* Subtle nautical grid overlay */}
        <div className="absolute inset-0 chart-grid opacity-[0.08]" />
        {/* Faint compass rose */}
        <CompassRose className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] text-white opacity-[0.03] -mr-52 hidden lg:block" />
        {/* Ghost typography depth layer — editorial overlap behind right column */}
        <div className="absolute inset-0 flex items-center justify-end pointer-events-none select-none overflow-hidden" aria-hidden>
          <span
            className="font-display font-black text-white hidden lg:block"
            style={{
              fontSize: 'clamp(9rem, 22vw, 18rem)',
              opacity: 0.025,
              letterSpacing: '-0.06em',
              lineHeight: 1,
              transform: 'translateX(8%) translateY(4%)',
            }}
          >
            NAVIGATE
          </span>
        </div>

        <div className="relative mx-auto max-w-7xl w-full">
          <div className="grid lg:grid-cols-[1fr_440px] gap-16 lg:gap-20 items-center">
            {/* Left column */}
            <div className="text-center lg:text-left animate-fade-in-up">
              {/* Live eyebrow pill */}
              <div className="inline-flex items-center gap-3 mb-8 justify-center lg:justify-start">
                <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: 'hsl(var(--seafoam))' }} />
                <span className="eyebrow-night">AI-Powered Passage Planning</span>
              </div>

              <h1 className="font-display tracking-tight">
                <span
                  className="block text-white font-normal"
                  style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', letterSpacing: '-0.02em', lineHeight: 1.1 }}
                >
                  Navigate with
                </span>
                <span
                  className="block font-bold italic"
                  style={{
                    fontSize: 'clamp(4rem, 10vw, 8rem)',
                    color: 'hsl(var(--seafoam))',
                    letterSpacing: '-0.03em',
                    lineHeight: 0.92,
                  }}
                >
                  Confidence
                </span>
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

              {/* Stats strip */}
              <div className="mt-12 flex items-start justify-center lg:justify-start">
                {[
                  { value: '70+', label: 'Ports Covered' },
                  { value: '6', label: 'AI Agents' },
                  { value: '<30s', label: 'Avg Plan Time' },
                ].map(({ value, label }, i) => (
                  <div
                    key={i}
                    className={i > 0 ? 'pl-8 ml-8' : ''}
                    style={i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.1)' } : undefined}
                  >
                    <p className="font-display font-bold text-white leading-none" style={{ fontSize: '1.75rem' }}>
                      {value}
                    </p>
                    <p className="font-mono-data text-[10px] uppercase tracking-widest mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — Glass Passage Plan Card */}
            <div className="relative hidden lg:block lg:mt-12 lg:-mr-6">
              <div className="relative" style={{ transform: 'translateX(20px) translateY(-30px)' }}>
                {/* Main glassmorphism card */}
                <div className="glass-night p-7 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display text-white text-lg">Passage Plan</h3>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                      style={{
                        background: 'hsl(var(--destructive) / 0.12)',
                        color: 'hsl(var(--destructive))',
                        border: '1px solid hsl(var(--destructive) / 0.3)',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-destructive pulse-live flex-shrink-0" />
                      LIVE
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
                        <p className="font-mono-data text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>184nm · Est. 28h</p>
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
                          <p className="font-mono-data text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                          <p className="font-mono-data text-sm font-medium text-white mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Safety status */}
                    <div
                      className="flex items-center gap-2.5 p-3 rounded-lg text-sm"
                      style={{ background: 'rgba(0,242,195,0.06)', border: '1px solid rgba(0,242,195,0.14)' }}
                    >
                      <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--seafoam))' }} />
                      <span style={{ color: 'hsl(var(--seafoam))' }}>All safety checks passed by AI agents</span>
                    </div>
                  </div>
                </div>

                {/* Floating status pill */}
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
                          background: 'rgba(0,242,195,0.1)',
                          border: '1px solid rgba(0,242,195,0.25)',
                        }}
                      >
                        <Navigation className="h-4 w-4" style={{ color: 'hsl(var(--seafoam))' }} />
                      </div>
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                        style={{ background: 'hsl(var(--seafoam))', border: '2px solid #0A1120' }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-none">Optimizing Route...</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>AI working</p>
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

      {/* Features Section — 3-col dark glass */}
      <section
        id="capabilities"
        className="relative px-4 py-28 sm:px-6 lg:px-8 lg:py-40 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(var(--night)) 100%)' }}
      >
        {/* Subtle chart grid */}
        <div className="absolute inset-0 chart-grid opacity-[0.05]" />
        {/* Ambient glow */}
        <div
          className="absolute bottom-0 right-0 w-[500px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at bottom right, rgba(226,179,110,0.05) 0%, transparent 65%)' }}
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="text-center mb-20 reveal-on-scroll">
            <span className="eyebrow-night mb-5 block">Capabilities</span>
            <h2 className="font-display text-white">
              Everything for Safe Passage Planning
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Six specialized AI agents work together to analyze conditions and optimize your route
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="reveal-on-scroll"><FeatureCard icon={Cloud} title="Weather Routing" description="Real-time NOAA forecasts with storm tracking, wind analysis, and optimal departure windows" accent="seafoam" dark /></div>
            <div className="reveal-on-scroll-delay-1"><FeatureCard icon={Waves} title="Tidal Analysis" description="Precise tide and current predictions from official NOAA stations along your route" accent="seafoam" dark /></div>
            <div className="reveal-on-scroll-delay-2"><FeatureCard icon={Map} title="Route Optimization" description="AI-calculated waypoints considering weather windows, currents, and hazards" accent="amber" dark /></div>
            <div className="reveal-on-scroll-delay-3"><FeatureCard icon={Anchor} title="Port Intelligence" description="Comprehensive marina data, facilities, entry requirements, and emergency contacts" accent="seafoam" dark /></div>
            <div className="reveal-on-scroll-delay-1"><FeatureCard icon={Shield} title="Safety Briefings" description="Automated risk assessment, USCG warnings, and emergency harbor identification" accent="amber" dark /></div>
            <div className="reveal-on-scroll-delay-2"><FeatureCard icon={Compass} title="Navigation Warnings" description="Live NAVTEX alerts, restricted zones, and Notice to Mariners for your route" accent="seafoam" dark /></div>
          </div>
        </div>
      </section>

      {/* How it Works — 2-col: step list + visual card */}
      <section
        id="process"
        className="relative px-4 py-24 sm:px-6 lg:px-8 lg:py-40 overflow-hidden"
        style={{ background: 'hsl(var(--night))' }}
      >
        <div className="absolute inset-0 chart-grid opacity-[0.06]" />
        <div
          className="absolute top-0 right-0 w-[500px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(0,242,195,0.04) 0%, transparent 70%)' }}
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-20 items-start">

            {/* Left — heading + numbered steps */}
            <div>
              <div className="mb-14 reveal-on-scroll">
                <span className="eyebrow-night mb-5 block">Process</span>
                <h2 className="font-display text-white">
                  Plan Your Passage in Minutes
                </h2>
                <p className="mt-5 max-w-lg text-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  From ports to comprehensive plan in three simple steps. Our AI handles the heavy lifting of data correlation.
                </p>
              </div>

              <div className="space-y-0">
                {[
                  {
                    step: '01',
                    title: 'Enter Your Route',
                    description: 'Select departure and destination ports, add waypoints, and set your departure time. We match to over 70 ports.',
                  },
                  {
                    step: '02',
                    title: 'AI Analysis',
                    description: 'Six specialized agents analyze weather, tides, hazards, and safety factors simultaneously.',
                  },
                  {
                    step: '03',
                    title: 'Get Your Plan',
                    description: 'Receive a comprehensive passage plan with GO/NO-GO decision, waypoints, and export options for your plotter.',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`flex gap-7 py-9 ${i < 2 ? 'border-b' : ''} ${i === 0 ? 'reveal-on-scroll' : i === 1 ? 'reveal-on-scroll-delay-1' : 'reveal-on-scroll-delay-2'}`}
                    style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                  >
                    <span
                      className="font-mono-data font-bold flex-shrink-0 leading-none"
                      style={{ color: 'hsl(var(--seafoam))', fontSize: '0.75rem', paddingTop: '4px', minWidth: '28px' }}
                    >
                      {item.step}
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — nautical visual card */}
            <div className="hidden lg:flex sticky top-24">
              <div
                className="relative w-full rounded-2xl flex items-center justify-center overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minHeight: '480px',
                }}
              >
                {/* Seafoam ambient glow */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,242,195,0.05) 0%, transparent 65%)' }}
                />
                {/* Large faint compass rose */}
                <CompassRose className="w-72 h-72 text-white opacity-[0.07]" />
                {/* Center icon overlay */}
                <div
                  className="absolute w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'rgba(0,242,195,0.1)',
                    border: '1px solid rgba(0,242,195,0.22)',
                    color: 'hsl(var(--seafoam))',
                  }}
                >
                  <Shield className="h-7 w-7" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <div id="pricing">
        <PricingSection />
      </div>

      {/* CTA Section — deep dark navy */}
      <section
        className="relative px-4 py-28 sm:px-6 lg:px-8 lg:py-40 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(222 47% 5%) 100%)' }}
      >
        {/* Chart grid */}
        <div className="absolute inset-0 chart-grid opacity-[0.07]" />
        {/* Glow center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(0,242,195,0.04) 0%, transparent 65%)' }}
        />
        <div className="relative mx-auto max-w-3xl text-center reveal-on-scroll">
          <span className="eyebrow-night mb-6 block">Get Started</span>
          <h2 className="font-display text-white text-balance">
            Ready to Navigate Smarter?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>
            AI-powered passage planning with real-time weather, tidal analysis, and comprehensive safety briefings. Your first 14 days are free.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="btn-seafoam group h-14 px-8 text-base">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" className="btn-night-outline h-14 px-8 text-base">
                Talk to Sales
              </Button>
            </Link>
          </div>

          <p className="mt-8 font-mono-data text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer — full dark navy */}
      <footer
        data-testid="footer"
        className="px-4 pt-16 pb-10 sm:px-6 lg:px-8"
        style={{
          background: 'hsl(var(--bg-deep))',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-4 mb-14">
            <div>
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,242,195,0.1)', border: '1px solid rgba(0,242,195,0.2)' }}
                >
                  <Anchor className="h-4 w-4" style={{ color: 'hsl(var(--seafoam))' }} />
                </div>
                <span className="font-display text-lg font-bold text-white">Helmwise</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                AI-powered passage planning for modern sailors. Navigate with confidence.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>Product</h4>
              <ul className="space-y-3 text-sm">
                {['Features', 'Pricing', 'Documentation', 'Changelog'].map(item => (
                  <li key={item}>
                    <Link href={`/${item.toLowerCase()}`} className="footer-link">{item}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>Company</h4>
              <ul className="space-y-3 text-sm">
                {['About', 'Blog', 'Careers', 'Contact'].map(item => (
                  <li key={item}>
                    <Link href={`/${item.toLowerCase()}`} className="footer-link">{item}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>Legal</h4>
              <ul className="space-y-3 text-sm">
                {[
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                  { label: 'Cookie Policy', href: '/cookies' },
                ].map(item => (
                  <li key={item.href}>
                    <Link href={item.href} className="footer-link">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="font-mono-data text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
              &copy; {new Date().getFullYear()} Helmwise. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              {[
                { href: 'https://twitter.com/helmwise', label: 'Twitter', path: 'M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84' },
                { href: 'https://github.com/helmwise', label: 'GitHub', path: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z' },
              ].map(social => (
                <a key={social.label} href={social.href} className="footer-icon" aria-label={social.label}>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d={social.path} fillRule="evenodd" clipRule="evenodd" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

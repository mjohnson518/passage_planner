import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '../components/layout/Header'
import {
  Anchor,
  Cloud,
  Waves,
  Map,
  Shield,
  Compass,
  Zap,
  ArrowRight,
  Heart,
  Target,
  Eye,
} from 'lucide-react'
import { Button } from '../components/ui/button'

export const metadata: Metadata = {
  title: 'About Helmwise - AI-Powered Passage Planning',
  description: 'Learn about Helmwise, our mission to make passage planning safer for sailors, and the technology behind our AI-powered platform.',
}

export default function AboutPage() {
  return (
    <>
      <Header />

      {/* Hero */}
      <section className="relative px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="badge-brass mb-4">About Helmwise</span>
          <h1 className="font-display mt-4 text-balance">
            Safer Passages Through
            <br />
            <span className="text-gradient">Smarter Planning</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Helmwise is an AI-powered passage planning platform built for sailors who take safety seriously. We combine real-time data from multiple sources with specialized AI agents to deliver comprehensive passage plans in seconds.
          </p>
        </div>
      </section>

      {/* Mission & Values */}
      <section className="section-alt px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-3">
            {[
              {
                icon: Target,
                title: 'Our Mission',
                description: 'To make comprehensive passage planning accessible to every sailor, reducing risk through better information and analysis.',
              },
              {
                icon: Heart,
                title: 'Safety First',
                description: 'Every feature we build prioritizes mariner safety. We apply conservative margins, present worst-case scenarios, and never suppress warnings.',
              },
              {
                icon: Eye,
                title: 'Transparency',
                description: 'We show our data sources, explain our recommendations, and make it clear when data is uncertain or stale. You always know why we recommend what we do.',
              },
            ].map((value, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-6">
                  <value.icon className="h-7 w-7" />
                </div>
                <h3 className="font-display text-xl mb-3">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology / Agent Architecture */}
      <section className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 chart-grid opacity-30" />

        <div className="relative mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <span className="badge-brass mb-4">Technology</span>
            <h2 className="font-display mt-4">
              How Helmwise Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Helmwise uses the Model Context Protocol to coordinate specialized AI agents. Each agent is an expert in its domain, working in parallel to deliver comprehensive analysis in seconds.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-4">
                {[
                  { name: 'Route Agent', desc: 'Calculates optimal waypoints and bearings using great-circle navigation' },
                  { name: 'Weather Agent', desc: 'Aggregates NOAA, OpenWeather, and buoy data for multi-model forecasts' },
                  { name: 'Tidal Agent', desc: 'Predicts tides and currents from official NOAA harmonic stations' },
                  { name: 'Safety Agent', desc: 'Assesses risks, identifies restricted areas, and finds emergency harbors' },
                  { name: 'Port Agent', desc: 'Provides marina facilities, entry requirements, and local knowledge for 70+ ports' },
                  { name: 'Warning Agent', desc: 'Monitors NAVTEX, coast guard alerts, and notices to mariners' },
                ].map((agent, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">{agent.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square max-w-md mx-auto">
                {/* Central hub */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-primary to-ocean-deep flex items-center justify-center shadow-maritime-lg z-10">
                  <Anchor className="h-10 w-10 text-primary-foreground" />
                </div>

                {/* Orbiting agents */}
                {[Cloud, Waves, Map, Shield, Anchor, Compass].map((Icon, i) => {
                  const angle = (i * 60) * (Math.PI / 180)
                  const radius = 140
                  const x = Math.cos(angle) * radius
                  const y = Math.sin(angle) * radius

                  return (
                    <div
                      key={i}
                      className="absolute w-14 h-14 rounded-full bg-card border-2 border-primary/20 flex items-center justify-center shadow-maritime animate-float"
                      style={{
                        top: `calc(50% + ${y}px - 28px)`,
                        left: `calc(50% + ${x}px - 28px)`,
                        animationDelay: `${i * 0.3}s`,
                      }}
                    >
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                  )
                })}

                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const angle = (i * 60) * (Math.PI / 180)
                    const x = 200 + Math.cos(angle) * 140
                    const y = 200 + Math.sin(angle) * 140
                    return (
                      <line
                        key={i}
                        x1="200"
                        y1="200"
                        x2={x}
                        y2={y}
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-primary/20"
                        strokeDasharray="4 4"
                      />
                    )
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Philosophy */}
      <section className="section-alt px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <span className="badge-primary mb-4">Safety Philosophy</span>
            <h2 className="font-display mt-4">Built for Life-Safety</h2>
          </div>

          <div className="card p-8 space-y-6">
            <p className="text-muted-foreground">
              Helmwise is designed as a <strong>supplementary tool</strong> to assist with passage planning. It is not a replacement for proper seamanship, navigation skills, or professional judgment. All data and recommendations should be verified against official sources.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                '20% clearance under keel minimum',
                '20% weather delay buffer applied',
                '30% fuel and water reserves recommended',
                'Worst-case scenario always presented',
                'Stale weather data automatically rejected',
                'Complete audit trail for all decisions',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-ocean px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-primary-foreground">
            Ready to Plan Safer Passages?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            Try Helmwise free and experience AI-powered passage planning with real-time weather, tidal analysis, and comprehensive safety briefings.
          </p>
          <div className="mt-10">
            <Link href="/signup">
              <Button size="lg" className="btn-brass group">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer (shared — could be componentized later) */}
      <footer className="px-4 py-12 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-primary" />
              <span className="font-display font-bold">Helmwise</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Helmwise. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

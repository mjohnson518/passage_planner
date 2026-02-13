import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/button'
import {
  Anchor,
  Cloud,
  Waves,
  Map,
  Shield,
  Ship,
  AlertTriangle,
  Download,
  Wifi,
  ArrowRight,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Features - Helmwise',
  description: 'Explore Helmwise features: AI-powered weather routing, tidal predictions, safety assessments, port database, GPX/PDF export, and offline PWA support.',
}

export default function FeaturesPage() {
  const agents = [
    {
      icon: Cloud,
      name: 'Weather Agent',
      description: 'Aggregates real-time data from NOAA, OpenWeather, and NDBC buoy networks. Multi-model weather forecasting with automatic worst-case scenario selection when sources disagree.',
    },
    {
      icon: Waves,
      name: 'Tidal Agent',
      description: 'Predicts tides and currents from official NOAA harmonic stations. Calculates ETA adjustments based on tidal current effects along your route.',
    },
    {
      icon: Map,
      name: 'Route Agent',
      description: 'Calculates optimal waypoints, bearings, and distances using great-circle navigation. Isochrone-based weather routing for the most efficient passage.',
    },
    {
      icon: Shield,
      name: 'Safety Agent',
      description: 'Assesses risks and generates GO, CAUTION, or NO-GO recommendations. Identifies restricted areas, finds emergency harbors, and enforces conservative safety margins.',
    },
    {
      icon: Ship,
      name: 'Port Agent',
      description: 'Comprehensive database of 70+ ports across the East Coast, Gulf, West Coast, Great Lakes, and Caribbean. Marina facilities, entry requirements, and local knowledge.',
    },
    {
      icon: AlertTriangle,
      name: 'Warning Agent',
      description: 'Monitors NAVTEX broadcasts, coast guard alerts, and notices to mariners. Surfaces active navigation warnings along your planned route.',
    },
  ]

  const capabilities = [
    {
      icon: Cloud,
      title: 'Real-Time Weather Routing',
      description: 'Multi-model weather aggregation from NOAA, OpenWeather, and NDBC buoy data. Isochrone-based routing finds the optimal path considering wind, waves, and currents. Stale data (older than 1 hour) is automatically rejected.',
    },
    {
      icon: Waves,
      title: 'Tidal Predictions & Current Analysis',
      description: 'Official NOAA harmonic station data for accurate tidal predictions. Current analysis adjusts your ETA based on tidal flow effects along each leg of your passage.',
    },
    {
      icon: Shield,
      title: 'Safety-First Decisions',
      description: 'Every passage plan receives a clear GO, CAUTION, or NO-GO assessment. Conservative safety margins are non-negotiable: 20% clearance under keel, 20% weather delay buffer, and 30% fuel and water reserves.',
    },
    {
      icon: Ship,
      title: 'Port Database',
      description: 'Detailed information on 70+ ports including marina facilities, fuel availability, entry requirements, approach hazards, and local knowledge. Covers the East Coast, Gulf, West Coast, Great Lakes, and Caribbean.',
    },
    {
      icon: Download,
      title: 'GPX & PDF Export',
      description: 'Export your passage plans as GPX files for import into your chartplotter or navigation app. Generate professional PDF briefings with weather, tidal, safety, and route details for your passage portfolio.',
    },
    {
      icon: Wifi,
      title: 'PWA Offline Support',
      description: 'Install Helmwise as a Progressive Web App on your phone or tablet. Access your saved passage plans offline when you lose connectivity at sea. Syncs automatically when back online.',
    },
  ]

  return (
    <>
      <Header />

      {/* Hero */}
      <section className="relative px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="badge-brass mb-4">Features</span>
          <h1 className="font-display mt-4 text-balance">
            Everything You Need for
            <br />
            <span className="text-gradient">Safer Passages</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Helmwise coordinates six specialized AI agents working in parallel to deliver comprehensive passage plans in seconds. Real-time data, conservative safety margins, and professional-grade exports.
          </p>
        </div>
      </section>

      {/* AI Agents */}
      <section className="section-alt px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="font-display">Six Specialized AI Agents</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Each agent is an expert in its domain, running in parallel via the Model Context Protocol to deliver analysis in seconds.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-6 hover:border-primary/30 transition-colors">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                  <agent.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg mb-2">{agent.name}</h3>
                <p className="text-sm text-muted-foreground">{agent.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="font-display">Platform Capabilities</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Built for mariners who take safety seriously.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            {capabilities.map((cap, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex-shrink-0">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                    <cap.icon className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display text-xl mb-2">{cap.title}</h3>
                  <p className="text-muted-foreground">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-ocean px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-primary-foreground">
            Ready to Plan Your Next Passage?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            Start with a free account and upgrade when you need more. See our plans and pricing.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="btn-brass group">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
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

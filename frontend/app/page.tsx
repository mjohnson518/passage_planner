'use client'

import Link from 'next/link'
import { Button } from './components/ui/button'
import { FeatureCard } from './components/marketing/FeatureCard'
import { PricingSection } from './components/marketing/PricingSection'
import { 
  Compass, 
  Cloud, 
  Waves, 
  Map, 
  Shield, 
  Anchor,
  ArrowRight,
  Star
} from 'lucide-react'

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="absolute inset-0 ocean-wave opacity-10"></div>
        
        <div className="relative mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              <span className="text-gradient">AI-Powered</span> Passage Planning
              <br />
              for Modern Sailors
            </h1>
            
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Plan your sailing passages with confidence using real-time weather data, 
              tidal predictions, and intelligent route optimization. 
              Built by sailors, for sailors.
            </p>
            
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="btn-primary">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline">
                  View Demo
                </Button>
              </Link>
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span>4.9/5 from 500+ sailors</span>
              </div>
              <div>14-day free trial</div>
              <div>No credit card required</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need for Safe Passage Planning
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Our AI agents work together to provide comprehensive passage planning
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Cloud}
              title="Weather Routing"
              description="Real-time weather forecasts and optimal routing to avoid storms and find favorable winds"
            />
            <FeatureCard
              icon={Waves}
              title="Tidal Planning"
              description="Precise tide and current predictions to time your passages perfectly"
            />
            <FeatureCard
              icon={Map}
              title="Interactive Charts"
              description="Plan routes on detailed nautical charts with waypoint optimization"
            />
            <FeatureCard
              icon={Anchor}
              title="Port Information"
              description="Comprehensive port data including facilities, contacts, and entry requirements"
            />
            <FeatureCard
              icon={Shield}
              title="Safety Briefings"
              description="Automated safety checklists and emergency contact information"
            />
            <FeatureCard
              icon={Compass}
              title="Route Optimization"
              description="AI-powered route suggestions based on your boat and preferences"
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-secondary/20 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Plan Your Passage in 3 Simple Steps
            </h2>
          </div>
          
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                1
              </div>
              <h3 className="mt-4 text-xl font-semibold">Enter Your Route</h3>
              <p className="mt-2 text-muted-foreground">
                Simply tell us where you're sailing from and to, and when you want to depart
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                2
              </div>
              <h3 className="mt-4 text-xl font-semibold">AI Analyzes Conditions</h3>
              <p className="mt-2 text-muted-foreground">
                Our agents analyze weather, tides, currents, and safety factors for your route
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                3
              </div>
              <h3 className="mt-4 text-xl font-semibold">Get Your Passage Plan</h3>
              <p className="mt-2 text-muted-foreground">
                Receive a comprehensive passage plan with waypoints, timing, and safety information
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="bg-primary px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to Plan Your Next Adventure?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            Join thousands of sailors who trust Passage Planner for their voyages
          </p>
          <div className="mt-10">
            <Link href="/signup">
              <Button size="lg" variant="secondary">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
} 
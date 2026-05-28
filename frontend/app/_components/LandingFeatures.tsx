import { FeatureCard } from "../components/marketing/FeatureCard";
import { Compass, Cloud, Waves, Map, Shield, Anchor } from "lucide-react";

export function LandingFeatures() {
  return (
    <section
      id="capabilities"
      className="relative px-4 py-28 sm:px-6 lg:px-8 lg:py-40 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(var(--night)) 100%)",
      }}
    >
      {/* Subtle chart grid */}
      <div className="absolute inset-0 chart-grid opacity-[0.05]" />
      {/* Ambient glow */}
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at bottom right, rgba(226,179,110,0.05) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="text-center mb-20 reveal-on-scroll">
          <span className="eyebrow-night mb-5 block">Capabilities</span>
          <h2 className="font-display text-white">
            Everything for Safe Passage Planning
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/45">
            Six specialized AI agents work together to analyze conditions and
            optimize your route
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="reveal-on-scroll">
            <FeatureCard
              icon={Cloud}
              title="Weather Routing"
              description="Real-time NOAA forecasts with storm tracking, wind analysis, and optimal departure windows"
              accent="seafoam"
              dark
            />
          </div>
          <div className="reveal-on-scroll-delay-1">
            <FeatureCard
              icon={Waves}
              title="Tidal Analysis"
              description="Precise tide and current predictions from official NOAA stations along your route"
              accent="seafoam"
              dark
            />
          </div>
          <div className="reveal-on-scroll-delay-2">
            <FeatureCard
              icon={Map}
              title="Route Optimization"
              description="AI-calculated waypoints considering weather windows, currents, and hazards"
              accent="amber"
              dark
            />
          </div>
          <div className="reveal-on-scroll-delay-3">
            <FeatureCard
              icon={Anchor}
              title="Port Intelligence"
              description="Comprehensive marina data, facilities, entry requirements, and emergency contacts"
              accent="seafoam"
              dark
            />
          </div>
          <div className="reveal-on-scroll-delay-1">
            <FeatureCard
              icon={Shield}
              title="Safety Briefings"
              description="Automated risk assessment, USCG warnings, and emergency harbor identification"
              accent="amber"
              dark
            />
          </div>
          <div className="reveal-on-scroll-delay-2">
            <FeatureCard
              icon={Compass}
              title="Navigation Warnings"
              description="Live NAVTEX alerts, restricted zones, and Notice to Mariners for your route"
              accent="seafoam"
              dark
            />
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { Button } from "../components/ui/button";
import { ParticleGrid } from "../components/marketing/ParticleGrid";
import { CompassRose, WaveDecoration } from "./decorations";
import {
  Compass,
  Cloud,
  Waves,
  ArrowRight,
  Navigation,
  CheckCircle,
} from "lucide-react";

const STATS = [
  { value: "70+", label: "Ports Covered" },
  { value: "6", label: "AI Agents" },
  { value: "<30s", label: "Avg Plan Time" },
];

const CONDITIONS = [
  { icon: Cloud, label: "Weather", value: "Clear" },
  { icon: Waves, label: "Seas", value: "2–4ft" },
  { icon: Compass, label: "Wind", value: "12kt SE" },
];

export function LandingHero() {
  return (
    <section className="section-night-hero relative min-h-screen flex items-center px-4 py-28 sm:px-6 lg:px-8">
      {/* Interactive particle grid — scoped to hero */}
      <ParticleGrid />
      {/* Subtle nautical grid overlay */}
      <div className="absolute inset-0 chart-grid opacity-[0.08]" />
      {/* Faint compass rose */}
      <CompassRose className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] text-white opacity-[0.03] -mr-52 hidden lg:block" />
      {/* Ghost typography depth layer — editorial overlap behind right column */}
      <div
        className="absolute inset-0 flex items-center justify-end pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <span
          className="font-display font-black text-white hidden lg:block"
          style={{
            fontSize: "clamp(9rem, 22vw, 18rem)",
            opacity: 0.025,
            letterSpacing: "-0.06em",
            lineHeight: 1,
            transform: "translateX(8%) translateY(4%)",
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
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                style={{ background: "hsl(var(--seafoam))" }}
              />
              <span className="eyebrow-night">AI-Powered Passage Planning</span>
            </div>

            <h1 className="font-display tracking-tight">
              <span
                className="block text-white font-normal"
                style={{
                  fontSize: "clamp(1.75rem, 4vw, 3rem)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                Navigate with
              </span>
              <span
                className="block font-bold italic"
                style={{
                  fontSize: "clamp(4rem, 10vw, 8rem)",
                  color: "hsl(var(--seafoam))",
                  letterSpacing: "-0.03em",
                  lineHeight: 0.92,
                }}
              >
                Confidence
              </span>
            </h1>

            <p className="mt-7 text-lg lg:text-xl max-w-xl mx-auto lg:mx-0 text-balance text-white/55">
              Helmwise orchestrates specialized AI agents to deliver
              comprehensive passage plans with real-time weather, tidal
              predictions, and safety analysis.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link href="/signup">
                <Button
                  data-testid="hero-cta-signup"
                  size="lg"
                  className="btn-seafoam group"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  data-testid="hero-cta-demo"
                  size="lg"
                  className="btn-night-outline"
                >
                  View Demo
                </Button>
              </Link>
            </div>

            {/* Stats strip */}
            <div className="mt-12 flex items-start justify-center lg:justify-start">
              {STATS.map(({ value, label }, i) => (
                <div
                  key={label}
                  className={i > 0 ? "pl-8 ml-8 border-l border-white/10" : ""}
                >
                  <p className="font-display font-bold text-white leading-none text-[1.75rem]">
                    {value}
                  </p>
                  <p className="font-mono-data text-[10px] uppercase tracking-widest mt-1.5 text-white/35">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — Glass Passage Plan Card */}
          <div className="relative hidden lg:block lg:mt-12 lg:-mr-6">
            <div
              className="relative"
              style={{ transform: "translateX(20px) translateY(-30px)" }}
            >
              {/* Main glassmorphism card */}
              <div
                className="glass-night p-7 animate-fade-in-up"
                style={{ animationDelay: "0.2s" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-white text-lg">
                    Passage Plan
                  </h3>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                    style={{
                      background: "hsl(var(--destructive) / 0.12)",
                      color: "hsl(var(--destructive))",
                      border: "1px solid hsl(var(--destructive) / 0.3)",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full bg-destructive pulse-live flex-shrink-0" />
                    LIVE
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Route */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.05] border border-white/[0.07]">
                    <Navigation
                      className="h-5 w-5 flex-shrink-0"
                      style={{ color: "hsl(var(--seafoam))" }}
                    />
                    <div>
                      <p className="text-sm font-medium text-white">
                        Miami, FL → Nassau, Bahamas
                      </p>
                      <p className="font-mono-data text-xs text-white/40">
                        184nm · Est. 28h
                      </p>
                    </div>
                  </div>

                  {/* Conditions grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {CONDITIONS.map(({ icon: Icon, label, value }) => (
                      <div
                        key={label}
                        className="p-3 rounded-lg text-center bg-white/[0.04] border border-white/[0.06]"
                      >
                        <Icon className="h-4 w-4 mx-auto mb-1 text-white/35" />
                        <p className="font-mono-data text-[9px] uppercase tracking-widest text-white/35">
                          {label}
                        </p>
                        <p className="font-mono-data text-sm font-medium text-white mt-0.5">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Safety status */}
                  <div
                    className="flex items-center gap-2.5 p-3 rounded-lg text-sm"
                    style={{
                      background: "rgba(0,242,195,0.06)",
                      border: "1px solid rgba(0,242,195,0.14)",
                    }}
                  >
                    <CheckCircle
                      className="h-4 w-4 flex-shrink-0"
                      style={{ color: "hsl(var(--seafoam))" }}
                    />
                    <span style={{ color: "hsl(var(--seafoam))" }}>
                      All safety checks passed by AI agents
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating status pill */}
              <div
                className="absolute -right-5 -bottom-5 animate-float"
                style={{ animationDelay: "0.5s" }}
              >
                <div className="glass-night px-4 py-3 flex items-center gap-3 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                  <div className="relative">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: "rgba(0,242,195,0.1)",
                        border: "1px solid rgba(0,242,195,0.25)",
                      }}
                    >
                      <Navigation
                        className="h-4 w-4"
                        style={{ color: "hsl(var(--seafoam))" }}
                      />
                    </div>
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{
                        background: "hsl(var(--seafoam))",
                        border: "2px solid #0A1120",
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-none">
                      Optimizing Route…
                    </p>
                    <p className="text-xs mt-1 text-white/40">AI working</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave fade to next section */}
      <div
        className="absolute bottom-0 left-0 right-0 w-full h-20"
        style={{ opacity: 0.04 }}
      >
        <WaveDecoration className="w-full h-full text-white" />
      </div>
    </section>
  );
}

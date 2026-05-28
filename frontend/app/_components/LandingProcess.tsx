import { Shield } from "lucide-react";
import { CompassRose } from "./decorations";

const STEPS = [
  {
    step: "01",
    title: "Enter Your Route",
    description:
      "Select departure and destination ports, add waypoints, and set your departure time. We match to over 70 ports.",
  },
  {
    step: "02",
    title: "AI Analysis",
    description:
      "Six specialized agents analyze weather, tides, hazards, and safety factors simultaneously.",
  },
  {
    step: "03",
    title: "Get Your Plan",
    description:
      "Receive a comprehensive passage plan with GO/NO-GO decision, waypoints, and export options for your plotter.",
  },
];

export function LandingProcess() {
  return (
    <section
      id="process"
      className="relative px-4 py-24 sm:px-6 lg:px-8 lg:py-40 overflow-hidden"
      style={{ background: "hsl(var(--night))" }}
    >
      <div className="absolute inset-0 chart-grid opacity-[0.06]" />
      <div
        className="absolute top-0 right-0 w-[500px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(0,242,195,0.04) 0%, transparent 70%)",
        }}
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
              <p className="mt-5 max-w-lg text-lg text-white/45">
                From ports to comprehensive plan in three simple steps. Our AI
                handles the heavy lifting of data correlation.
              </p>
            </div>

            <div className="space-y-0">
              {STEPS.map((item, i) => (
                <div
                  key={item.step}
                  className={`flex gap-7 py-9 ${i < 2 ? "border-b border-white/[0.07]" : ""} ${i === 0 ? "reveal-on-scroll" : i === 1 ? "reveal-on-scroll-delay-1" : "reveal-on-scroll-delay-2"}`}
                >
                  <span
                    className="font-mono-data font-bold flex-shrink-0 leading-none"
                    style={{
                      color: "hsl(var(--seafoam))",
                      fontSize: "0.75rem",
                      paddingTop: "4px",
                      minWidth: "28px",
                    }}
                  >
                    {item.step}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-white/50">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — nautical visual card */}
          <div className="hidden lg:flex sticky top-24">
            <div className="relative w-full rounded-2xl flex items-center justify-center overflow-hidden bg-white/[0.02] border border-white/[0.08] min-h-[480px]">
              {/* Seafoam ambient glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,242,195,0.05) 0%, transparent 65%)",
                }}
              />
              {/* Large faint compass rose */}
              <CompassRose className="w-72 h-72 text-white opacity-[0.07]" />
              {/* Center icon overlay */}
              <div
                className="absolute w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(0,242,195,0.1)",
                  border: "1px solid rgba(0,242,195,0.22)",
                  color: "hsl(var(--seafoam))",
                }}
              >
                <Shield className="h-7 w-7" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

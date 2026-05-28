"use client";

interface CrewCert {
  id: string;
  crew_name: string | null;
  cert_type: string;
  cert_label: string | null;
  expiry_date: string;
}

interface PolarVessel {
  id: string;
  name: string;
}

interface PlanningOptionsTogglesProps {
  tierLocked: boolean;
  // Crew certification check (F1)
  crewCerts: CrewCert[];
  crewCheckEnabled: boolean;
  selectedCrewIds: Set<string>;
  onCrewCheckEnabledChange: (value: boolean) => void;
  onToggleCrew: (id: string, checked: boolean) => void;
  // Polar-tuned routing (V1)
  polarVessels: PolarVessel[];
  usePolars: boolean;
  polarVesselId: string;
  onUsePolarsChange: (value: boolean) => void;
  onPolarVesselIdChange: (value: string) => void;
  // Multi-model (R1)
  multiModel: boolean;
  onMultiModelChange: (value: boolean) => void;
}

export function PlanningOptionsToggles({
  tierLocked,
  crewCerts,
  crewCheckEnabled,
  selectedCrewIds,
  onCrewCheckEnabledChange,
  onToggleCrew,
  polarVessels,
  usePolars,
  polarVesselId,
  onUsePolarsChange,
  onPolarVesselIdChange,
  multiModel,
  onMultiModelChange,
}: PlanningOptionsTogglesProps) {
  return (
    <>
      {/* F1 — Crew certification check (Pro hard-gated). Only renders when
          the user has any tracked certs. Surfaces expiry warnings in
          safety.warnings; advisory only, never blocks the plan. */}
      {crewCerts.length > 0 && !tierLocked && (
        <div className="max-w-4xl mx-auto mt-4 mb-2">
          <label className="flex items-start gap-3 cursor-pointer rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={crewCheckEnabled}
              onChange={(e) => onCrewCheckEnabledChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  Check crew certifications
                </span>
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  Pro
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Warn if any selected crew cert is expired or expires within 30
                days of departure. Advisory only.
              </p>
              {crewCheckEnabled && (
                <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto rounded-md border border-border bg-muted/40 p-2">
                  {crewCerts.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        aria-label={`Include ${c.crew_name ?? "crew member"} (${c.cert_label ?? c.cert_type}) in crew certification check`}
                        checked={selectedCrewIds.has(c.id)}
                        onChange={(e) => onToggleCrew(c.id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      <span className="font-medium">
                        {c.crew_name ?? "Crew"}
                      </span>
                      <span className="text-muted-foreground">
                        {c.cert_label ?? c.cert_type}
                      </span>
                      <span className="text-muted-foreground ml-auto">
                        exp {c.expiry_date}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </label>
        </div>
      )}

      {/* V1 — polar-aware routing toggle (Premium hard-gated). Only renders
          when the user has at least one vessel in their library. */}
      {polarVessels.length > 0 && !tierLocked && (
        <div className="max-w-4xl mx-auto mt-4 mb-2">
          <label className="flex items-start gap-3 cursor-pointer rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={usePolars}
              onChange={(e) => onUsePolarsChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Polar-tuned route</span>
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  Premium
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use your vessel&apos;s actual speed-vs-wind curves instead of a
                generic cruising estimate. No automatic land avoidance; verify
                the generated route on the chart.
              </p>
              {usePolars && (
                <div className="mt-2">
                  <select
                    value={polarVesselId}
                    onChange={(e) => onPolarVesselIdChange(e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {polarVessels.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </label>
        </div>
      )}

      {/* Multi-model toggle (R1) — Premium feature, soft-degrades on the
          server so Free users still get a plan. */}
      <div className="max-w-4xl mx-auto mt-4 mb-2">
        <label className="flex items-start gap-3 cursor-pointer rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors">
          <input
            type="checkbox"
            checked={multiModel}
            onChange={(e) => onMultiModelChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Compare multiple weather models
              </span>
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                Premium
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Surface where GFS, ECMWF, and ICON disagree about the forecast for
              your departure. Wider spread = lower confidence.
            </p>
          </div>
        </label>
      </div>
    </>
  );
}

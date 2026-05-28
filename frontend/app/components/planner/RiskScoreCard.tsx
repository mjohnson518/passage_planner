"use client";

import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Info,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";

type RiskStatus = "GO" | "CAUTION" | "NO-GO";
type CategoryStatus = "good" | "marginal" | "poor" | "unknown";
type CategoryName = "weather" | "depth" | "hazards" | "reserves" | "crew";

interface RiskCategoryScore {
  category: CategoryName;
  weight: number;
  score: number;
  status: CategoryStatus;
  contributors: string[];
}

export interface RiskScore {
  score: number;
  status: RiskStatus;
  breakdown: RiskCategoryScore[];
  hardFails: string[];
  disclaimers: string[];
  dataMissing: string[];
  generatedAt: string;
  weatherDataAgeMin: number | null;
  multiModelApplied: boolean;
}

interface RiskScoreCardProps {
  riskScore: RiskScore;
}

const STATUS_META: Record<
  RiskStatus,
  {
    label: string;
    blurb: string;
    classes: string;
    Icon: typeof Compass;
  }
> = {
  GO: {
    label: "GO",
    blurb: "Conditions are favorable for this passage.",
    classes:
      "bg-success/10 border-success/40 text-success [&_[data-bar]]:bg-success",
    Icon: CheckCircle2,
  },
  CAUTION: {
    label: "CAUTION",
    blurb:
      "Marginal conditions or missing data. Review the breakdown carefully before departing.",
    classes:
      "bg-warning/10 border-warning/40 text-warning [&_[data-bar]]:bg-warning",
    Icon: AlertCircle,
  },
  "NO-GO": {
    label: "NO-GO",
    blurb:
      "One or more hard limits are violated. Do not depart without resolving the failures listed below.",
    classes:
      "bg-destructive/10 border-destructive/40 text-destructive [&_[data-bar]]:bg-destructive",
    Icon: TriangleAlert,
  },
};

const CATEGORY_LABELS: Record<CategoryName, string> = {
  weather: "Weather",
  depth: "Depth & tides",
  hazards: "Hazards",
  reserves: "Fuel & water",
  crew: "Crew",
};

function categoryBarColor(status: CategoryStatus): string {
  switch (status) {
    case "good":
      return "bg-success";
    case "marginal":
      return "bg-warning";
    case "poor":
      return "bg-destructive";
    case "unknown":
      return "bg-muted-foreground";
  }
}

export function RiskScoreCard({ riskScore }: RiskScoreCardProps) {
  const meta = STATUS_META[riskScore.status];

  return (
    <Card
      className={cn("border-2", meta.classes)}
      data-testid="planner-risk-score"
    >
      <CardContent className="p-6 space-y-6">
        {/* Hero — status + score */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border-2 flex-shrink-0",
              meta.classes,
            )}
          >
            <meta.Icon className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h2 className="font-display text-3xl tracking-tight">
                {meta.label}
              </h2>
              <div className="text-right">
                <p className="text-3xl font-bold tabular-nums">
                  {riskScore.score}
                  <span className="text-base text-muted-foreground">/100</span>
                </p>
              </div>
            </div>
            <p className="text-sm text-foreground/80 mt-1">{meta.blurb}</p>
          </div>
        </div>

        {/* Hard fails — always above the breakdown so they can't be missed */}
        {riskScore.hardFails.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" />
              Hard limits violated
            </p>
            <ul className="space-y-1 text-sm text-destructive/90">
              {riskScore.hardFails.map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Per-category breakdown */}
        <div>
          <p className="text-sm font-medium mb-3 text-foreground">
            Breakdown by category
          </p>
          <ul className="space-y-3">
            {riskScore.breakdown.map((b) => (
              <li key={b.category}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-foreground">
                    {CATEGORY_LABELS[b.category]}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({Math.round(b.weight * 100)}%)
                    </span>
                  </span>
                  <span className="tabular-nums text-foreground/80">
                    {b.score}/100 · {b.status}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    data-bar
                    className={cn(
                      "h-full rounded-full transition-all",
                      categoryBarColor(b.status),
                    )}
                    style={{ width: `${b.score}%` }}
                  />
                </div>
                {b.contributors.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {b.contributors.slice(0, 3).map((c) => (
                      <li
                        key={c}
                        className="text-xs text-muted-foreground pl-1"
                      >
                        - {c}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Missing data warning */}
        {riskScore.dataMissing.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm flex items-start gap-2">
            <Info className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-foreground/90">
              <p className="font-medium text-warning mb-0.5">
                Data missing for: {riskScore.dataMissing.join(", ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Score defaults to a conservative value for missing categories.
                Fill in the gaps to refine the verdict.
              </p>
            </div>
          </div>
        )}

        {/* Multi-model uplift indicator */}
        {riskScore.multiModelApplied && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            Premium multi-model widening applied: score reflects forecast
            disagreement.
          </p>
        )}

        {/* Mandatory disclaimers */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">
            Decision contract
          </p>
          <ul className="space-y-1">
            {riskScore.disclaimers.map((d) => (
              <li key={d} className="text-xs text-muted-foreground">
                • {d}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

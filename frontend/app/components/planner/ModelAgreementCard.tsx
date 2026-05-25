"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";

type AgreementStatus = "agree" | "mild" | "divergent";

interface VariableAgreement {
  variable:
    | "wind_speed_kt"
    | "wind_gust_kt"
    | "wave_height_m"
    | "temperature_f";
  consensus: number;
  worstCase: number;
  spread: number;
  status: AgreementStatus;
  perModel: Record<string, number>;
}

export interface ModelComparison {
  location: { latitude: number; longitude: number };
  issuedAt: string;
  models: string[];
  evaluatedAt: string;
  windSpeed: VariableAgreement | null;
  windGust: VariableAgreement | null;
  waveHeight: VariableAgreement | null;
  temperature: VariableAgreement | null;
  recommendation: string;
}

interface ModelAgreementCardProps {
  comparison: ModelComparison | null;
  /** True when the user asked for multi-model but their tier doesn't include
   *  it. Drives the upsell teaser instead of hiding the card. */
  gated?: boolean;
}

const MODEL_LABELS: Record<string, string> = {
  gfs_seamless: "GFS (NOAA)",
  ecmwf_ifs025: "ECMWF",
  icon_seamless: "ICON (DWD)",
};

const VARIABLE_LABELS: Record<VariableAgreement["variable"], string> = {
  wind_speed_kt: "Wind speed",
  wind_gust_kt: "Wind gusts",
  wave_height_m: "Wave height",
  temperature_f: "Temperature",
};

const VARIABLE_UNITS: Record<VariableAgreement["variable"], string> = {
  wind_speed_kt: "kt",
  wind_gust_kt: "kt",
  wave_height_m: "m",
  temperature_f: "°F",
};

const STATUS_META: Record<
  AgreementStatus,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  agree: {
    label: "Models agree",
    classes: "text-success bg-success/10 border-success/30",
    Icon: CheckCircle2,
  },
  mild: {
    label: "Mild disagreement",
    classes: "text-warning bg-warning/10 border-warning/30",
    Icon: AlertTriangle,
  },
  divergent: {
    label: "Significant disagreement",
    classes: "text-destructive bg-destructive/10 border-destructive/30",
    Icon: TriangleAlert,
  },
};

function formatValue(v: number, variable: VariableAgreement["variable"]) {
  if (!Number.isFinite(v)) return "—";
  if (variable === "wave_height_m") return v.toFixed(1);
  if (variable === "temperature_f") return v.toFixed(0);
  return v.toFixed(0);
}

export function ModelAgreementCard({
  comparison,
  gated,
}: ModelAgreementCardProps) {
  if (gated) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg">Model agreement</h3>
              <p className="text-sm text-muted-foreground">
                See how GFS, ECMWF, and ICON compare for your route and where
                they diverge.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Multi-model comparison is a Premium feature.
            </p>
          </div>
          <div className="flex justify-end">
            <Link href="/pricing">
              <Button size="sm">Upgrade to Premium</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!comparison) return null;

  const variables: VariableAgreement[] = [
    comparison.windSpeed,
    comparison.windGust,
    comparison.waveHeight,
    comparison.temperature,
  ].filter((v): v is VariableAgreement => v !== null);

  if (variables.length === 0) return null;

  // Overall status — divergent > mild > agree.
  const overall: AgreementStatus = variables.some(
    (v) => v.status === "divergent",
  )
    ? "divergent"
    : variables.some((v) => v.status === "mild")
      ? "mild"
      : "agree";
  const overallMeta = STATUS_META[overall];

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg">Model agreement</h3>
              <p className="text-sm text-muted-foreground">
                Forecast at {new Date(comparison.evaluatedAt).toUTCString()}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              overallMeta.classes,
            )}
          >
            <overallMeta.Icon className="h-3.5 w-3.5" />
            {overallMeta.label}
          </span>
        </div>

        <ul className="space-y-4">
          {variables.map((v) => {
            const meta = STATUS_META[v.status];
            return (
              <li key={v.variable} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">
                      {VARIABLE_LABELS[v.variable]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Consensus {formatValue(v.consensus, v.variable)}{" "}
                      {VARIABLE_UNITS[v.variable]} · worst case{" "}
                      {formatValue(v.worstCase, v.variable)}{" "}
                      {VARIABLE_UNITS[v.variable]} · spread{" "}
                      {formatValue(v.spread, v.variable)}{" "}
                      {VARIABLE_UNITS[v.variable]}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border",
                      meta.classes,
                    )}
                  >
                    <meta.Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                </div>
                <div className="space-y-1">
                  {Object.entries(v.perModel).map(([model, value]) => (
                    <div
                      key={model}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="w-28 text-muted-foreground truncate">
                        {MODEL_LABELS[model] ?? model}
                      </span>
                      <span className="font-mono w-12 text-right">
                        {formatValue(value, v.variable)}{" "}
                        {VARIABLE_UNITS[v.variable]}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <div
          className={cn("rounded-md border p-3 text-sm", overallMeta.classes)}
        >
          {comparison.recommendation}
        </div>
      </CardContent>
    </Card>
  );
}

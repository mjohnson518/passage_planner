"use client";

import {
  AlertCircle,
  CheckCircle2,
  Crown,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";
import type {
  CandidateResult,
  CompareResponse,
} from "../../../lib/services/passagePlanningService";

interface DepartureComparisonCardsProps {
  comparison: CompareResponse;
  /** Index of the currently-selected candidate (visually highlighted). */
  selectedIndex: number | null;
  /** Called when the user clicks "Select this window" on a card. */
  onSelect: (index: number) => void;
}

const STATUS_META: Record<
  "GO" | "CAUTION" | "NO-GO",
  { Icon: typeof CheckCircle2; classes: string; label: string }
> = {
  GO: {
    Icon: CheckCircle2,
    classes: "text-success bg-success/10 border-success/40",
    label: "GO",
  },
  CAUTION: {
    Icon: AlertCircle,
    classes: "text-warning bg-warning/10 border-warning/40",
    label: "CAUTION",
  },
  "NO-GO": {
    Icon: TriangleAlert,
    classes: "text-destructive bg-destructive/10 border-destructive/40",
    label: "NO-GO",
  },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEta(plan: CandidateResult): string {
  if (plan.status !== "ok") return "—";
  // estimatedTime is the typed field on PassagePlanningResponse.summary;
  // estimatedArrival is a sibling we attach server-side at plan assembly
  // time. Either is acceptable as the ETA display.
  const summary = plan.plan.summary as
    | undefined
    | (typeof plan.plan.summary & { estimatedArrival?: string });
  const iso = summary?.estimatedArrival ?? summary?.estimatedTime;
  if (!iso) return "—";
  try {
    return new Date(iso as string).toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function DepartureComparisonCards({
  comparison,
  selectedIndex,
  onSelect,
}: DepartureComparisonCardsProps) {
  const { candidates, bestIndex, summary } = comparison;
  if (candidates.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg mb-1">
            Departure window comparison
          </h2>
          <p className="text-sm text-muted-foreground">
            Risk score per candidate. Click a card to use its plan below.
          </p>
        </div>

        {summary.length > 0 && (
          <ul className="space-y-1">
            {summary.map((line, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                — {line}
              </li>
            ))}
          </ul>
        )}

        <div
          className={cn(
            "grid gap-3",
            candidates.length === 1 && "grid-cols-1",
            candidates.length === 2 && "grid-cols-1 sm:grid-cols-2",
            candidates.length === 3 && "grid-cols-1 sm:grid-cols-3",
          )}
        >
          {candidates.map((c, idx) => {
            const isBest = bestIndex === idx;
            const isSelected = selectedIndex === idx;

            if (c.status === "error") {
              return (
                <div
                  key={idx}
                  className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
                >
                  <p className="font-medium flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {formatTime(c.departureTime)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Plan failed: {c.error}
                  </p>
                </div>
              );
            }

            const risk = c.plan.riskScore;
            const status = risk?.status ?? "CAUTION";
            const meta = STATUS_META[status];
            const distance = c.plan.summary?.totalDistance ?? "—";
            const warnings = (c.plan.summary?.warnings ?? []).slice(0, 2);

            return (
              <div
                key={idx}
                className={cn(
                  "rounded-md border-2 p-4 flex flex-col gap-3 transition-all",
                  meta.classes,
                  isSelected && "ring-2 ring-primary ring-offset-2",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground tracking-wide">
                      Depart
                    </p>
                    <p className="text-sm font-medium">
                      {formatTime(c.departureTime)}
                    </p>
                  </div>
                  {isBest && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                      <Crown className="h-3 w-3" />
                      Best
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <meta.Icon className="h-5 w-5" />
                  <span className="font-display text-2xl">{meta.label}</span>
                  {risk && (
                    <span className="text-sm font-medium tabular-nums opacity-80">
                      {risk.score}/100
                    </span>
                  )}
                </div>

                <div className="text-xs space-y-1 text-foreground/80">
                  <p>
                    <span className="text-muted-foreground">ETA:</span>{" "}
                    {formatEta(c)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Distance:</span>{" "}
                    {distance}
                  </p>
                </div>

                {warnings.length > 0 && (
                  <ul className="text-xs space-y-0.5 text-foreground/80">
                    {warnings.map((w, i) => (
                      <li key={i} className="truncate">
                        • {w}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto pt-2">
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => onSelect(idx)}
                    fullWidth
                  >
                    {isSelected ? "Currently shown" : "Select this window"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

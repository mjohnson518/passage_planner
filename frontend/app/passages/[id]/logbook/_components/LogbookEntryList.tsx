"use client";

import { BookOpen, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { cn } from "../../../../lib/utils";
import {
  TYPE_META,
  formatDateTime,
  formatPosition,
  isWithin5Min,
  type LogbookEntry,
  type TierState,
} from "./types";

interface LogbookEntryListProps {
  loading: boolean;
  entries: LogbookEntry[];
  tier: TierState;
  onDelete: (entry: LogbookEntry) => void;
}

export function LogbookEntryList({
  loading,
  entries,
  tier,
  onDelete,
}: LogbookEntryListProps) {
  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Loading logbook…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-8 w-8" />}
        title="Logbook is empty"
        description="A departure entry is added automatically when you save a passage. Add watch handovers and observations as the passage progresses."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map((e) => {
        const meta = TYPE_META[e.entry_type];
        const occurred = formatDateTime(e.occurred_at);
        const recorded = formatDateTime(e.recorded_at);
        const sameTime =
          Math.abs(
            new Date(e.occurred_at).getTime() -
              new Date(e.recorded_at).getTime(),
          ) < 60_000;
        const canDelete = tier === "premium" && isWithin5Min(e.recorded_at);
        return (
          <li key={e.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      meta.classes,
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {occurred}
                  </span>
                  {!sameTime && (
                    <span className="text-xs text-muted-foreground italic">
                      (recorded {recorded})
                    </span>
                  )}
                </div>
                {e.position_lat !== null && e.position_lon !== null && (
                  <p className="text-sm font-mono text-muted-foreground">
                    {formatPosition(e.position_lat, e.position_lon)}
                  </p>
                )}
                {e.notes && <p className="text-sm">{e.notes}</p>}
                {e.conditions && Object.keys(e.conditions).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Object.entries(e.conditions)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ")}
                  </p>
                )}
                {e.recorded_by && (
                  <p className="text-xs text-muted-foreground italic">
                    - {e.recorded_by}
                  </p>
                )}
              </div>
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(e)}
                  aria-label="Delete (within 5 min undo)"
                  title="Delete (typo undo, within 5 minutes)"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

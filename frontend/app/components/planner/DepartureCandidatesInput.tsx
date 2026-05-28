"use client";

import { useRef } from "react";
import Link from "next/link";
import { Clock, Plus, Sparkles, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface DepartureCandidatesInputProps {
  /** When false, the section is collapsed to just the opt-in checkbox. */
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  /** ISO datetime-local strings (e.g. "2026-03-12T06:00"). The list length is
   *  the candidate count; max 3. */
  candidates: string[];
  onCandidatesChange: (next: string[]) => void;
  /** When the user is not Pro/Premium, render the upsell teaser and disable
   *  the controls. */
  tierLocked: boolean;
}

const MAX_CANDIDATES = 3;

/** Default departure-time suggestion when the user opens the section for the
 *  first time. Uses local "tomorrow 06:00" so the picker isn't blank. */
function defaultFirstCandidate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(6, 0, 0, 0);
  return d.toISOString().slice(0, 16); // datetime-local format
}

export function DepartureCandidatesInput({
  enabled,
  onEnabledChange,
  candidates,
  onCandidatesChange,
  tierLocked,
}: DepartureCandidatesInputProps) {
  // Stable per-row identities. `candidates` is a plain `string[]` shared with
  // the parent and the compare API, and values can be empty/duplicate while
  // editing, so the array index isn't a safe React key. We keep a parallel list
  // of monotonic ids aligned positionally with `candidates` (the only mutations
  // are append and remove-by-index), giving each row a persistent identity.
  const nextIdRef = useRef(0);
  const idsRef = useRef<number[]>([]);
  while (idsRef.current.length < candidates.length) {
    idsRef.current.push(nextIdRef.current++);
  }
  if (idsRef.current.length > candidates.length) {
    idsRef.current = idsRef.current.slice(0, candidates.length);
  }
  const rowIds = idsRef.current;

  const handleToggle = (next: boolean) => {
    onEnabledChange(next);
    if (next && candidates.length === 0) {
      onCandidatesChange([defaultFirstCandidate()]);
    }
  };

  const handleAdd = () => {
    if (candidates.length >= MAX_CANDIDATES) return;
    const last = candidates[candidates.length - 1] ?? defaultFirstCandidate();
    const lastDate = new Date(last);
    if (Number.isFinite(lastDate.getTime())) {
      lastDate.setDate(lastDate.getDate() + 1);
      onCandidatesChange([...candidates, lastDate.toISOString().slice(0, 16)]);
    } else {
      onCandidatesChange([...candidates, defaultFirstCandidate()]);
    }
  };

  const handleRemove = (idx: number) => {
    // Drop the matching row id so remaining rows keep their identity.
    idsRef.current = idsRef.current.filter((_, i) => i !== idx);
    onCandidatesChange(candidates.filter((_, i) => i !== idx));
  };

  const handleChange = (idx: number, value: string) => {
    onCandidatesChange(candidates.map((c, i) => (i === idx ? value : c)));
  };

  return (
    <div className="max-w-4xl mx-auto mt-4 mb-2">
      <label
        className={cn(
          "flex items-start gap-3 cursor-pointer rounded-md border border-border bg-card p-3 transition-colors",
          !tierLocked && "hover:bg-muted/40",
          tierLocked && "opacity-80",
        )}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={tierLocked}
          onChange={(e) => handleToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Compare departure times</span>
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
              Premium
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plan up to {MAX_CANDIDATES} candidate departures side-by-side and
            pick the best weather window.
          </p>
        </div>
      </label>

      {tierLocked && enabled && (
        <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground flex-1">
            Multi-window comparison is a Premium feature.
          </p>
          <Link
            href="/pricing"
            className="text-sm text-primary hover:underline font-medium"
          >
            Upgrade
          </Link>
        </div>
      )}

      {enabled && !tierLocked && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-card p-3">
          {candidates.map((value, idx) => (
            <div key={rowIds[idx]} className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                type="datetime-local"
                aria-label={`Departure time option ${idx + 1}`}
                value={value}
                onChange={(e) => handleChange(idx, e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {candidates.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(idx)}
                  aria-label="Remove this departure time"
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {candidates.length < MAX_CANDIDATES && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add another time ({candidates.length}/{MAX_CANDIDATES})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

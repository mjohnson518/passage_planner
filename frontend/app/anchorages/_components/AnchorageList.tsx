import Link from "next/link";
import { Anchor, MessageSquare } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { cn } from "../../lib/utils";

type Holding = "good" | "fair" | "poor" | "unknown";

export interface AnchorageSummary {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string | null;
  region: string | null;
  description: string | null;
  holding: Holding | null;
  shelter_from: string[] | null;
  swing_room: string | null;
  notes_count: number;
  last_note_at: string | null;
  created_at: string;
  distance_km?: number; // populated by spatial query
}

function freshnessFor(lastNoteAt: string | null): {
  label: string;
  classes: string;
} {
  if (!lastNoteAt)
    return {
      label: "No notes yet",
      classes: "text-muted-foreground bg-muted border-border",
    };
  const months =
    (Date.now() - new Date(lastNoteAt).getTime()) / (30 * 24 * 60 * 60 * 1000);
  if (months > 12)
    return {
      label: `Stale (${Math.round(months)}mo)`,
      classes: "text-destructive bg-destructive/10 border-destructive/30",
    };
  if (months > 6)
    return {
      label: `${Math.round(months)}mo old`,
      classes: "text-warning bg-warning/10 border-warning/30",
    };
  return {
    label: `Recent (${Math.round(months * 4)}wk)`,
    classes: "text-success bg-success/10 border-success/30",
  };
}

export function AnchorageList({
  loading,
  list,
  mode,
}: {
  loading: boolean;
  list: AnchorageSummary[];
  mode: "recent" | "near" | "search";
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading anchorages…
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Anchor className="h-8 w-8" />}
            title="No anchorages here yet"
            description={
              mode === "near"
                ? "Nothing contributed within 50 km of your position. Be the first — sailors after you will thank you."
                : mode === "search"
                  ? "No matches. Try a shorter search term or browse Recent / Near me."
                  : "The database is empty. Be the first to add an anchorage."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((a) => {
              const freshness = freshnessFor(a.last_note_at);
              return (
                <li key={a.id}>
                  <Link
                    href={`/anchorages/${a.id}`}
                    className="block p-5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[a.region, a.country].filter(Boolean).join(", ") ||
                            `${a.lat.toFixed(3)}, ${a.lon.toFixed(3)}`}
                          {a.distance_km !== undefined && (
                            <span className="ml-2 font-mono">
                              · {a.distance_km.toFixed(1)} km away
                            </span>
                          )}
                        </p>
                        {a.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {a.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                            freshness.classes,
                          )}
                        >
                          {freshness.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {a.notes_count} note
                          {a.notes_count === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from "../../../components/ui/card";

type Holding = "good" | "fair" | "poor" | "unknown";

interface Anchorage {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string | null;
  region: string | null;
  description: string | null;
  approx_depth_m: number | null;
  holding: Holding | null;
  shelter_from: string[] | null;
  swing_room: string | null;
  notes_count: number;
  last_note_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function AnchorageHero({
  anchorage,
  isCreator,
}: {
  anchorage: Anchorage;
  isCreator: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h1 className="font-display text-4xl mb-1">{anchorage.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[anchorage.region, anchorage.country].filter(Boolean).join(", ") ||
              "Unknown region"}
            <span className="ml-2 font-mono">
              {anchorage.lat.toFixed(4)}, {anchorage.lon.toFixed(4)}
            </span>
          </p>
        </div>
        {anchorage.description && (
          <p className="text-sm">{anchorage.description}</p>
        )}
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {anchorage.approx_depth_m !== null && (
            <div>
              <dt className="text-muted-foreground text-xs">Approx depth</dt>
              <dd>{anchorage.approx_depth_m} m</dd>
            </div>
          )}
          {anchorage.holding && (
            <div>
              <dt className="text-muted-foreground text-xs">Holding</dt>
              <dd className="capitalize">{anchorage.holding}</dd>
            </div>
          )}
          {anchorage.shelter_from && anchorage.shelter_from.length > 0 && (
            <div>
              <dt className="text-muted-foreground text-xs">Shelter from</dt>
              <dd>{anchorage.shelter_from.join(", ")}</dd>
            </div>
          )}
          {anchorage.swing_room && (
            <div>
              <dt className="text-muted-foreground text-xs">Swing room</dt>
              <dd className="capitalize">{anchorage.swing_room}</dd>
            </div>
          )}
        </dl>
        {isCreator && (
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            You added this anchorage, you can edit the structured fields above.
            (Editing UI coming soon; for now, contact support to update.)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

import {
  AlertTriangle,
  Anchor,
  BellOff,
  CheckCircle2,
  RotateCw,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { SwingCircle } from "./SwingCircle";
import {
  bearingDeg,
  formatTime,
  type AnchorState,
  type PositionReading,
  type WatchStatus,
} from "./lib";

export function StatusHero({
  status,
  anchor,
  current,
  distance,
  accuracy,
  supported,
  permissionDenied,
  onAcknowledge,
  onDrop,
  onWeigh,
}: {
  status: WatchStatus;
  anchor: AnchorState | null;
  current: PositionReading | null;
  distance: number | null;
  accuracy: number | null;
  supported: boolean;
  permissionDenied: boolean;
  onAcknowledge: () => void;
  onDrop: () => void;
  onWeigh: () => void;
}) {
  return (
    <Card
      className={cn(
        "border-2",
        status === "alarming" &&
          "border-destructive bg-destructive/5 animate-pulse",
        status === "watching" && "border-success/40 bg-success/5",
        status === "idle" && "border-border",
      )}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border-2",
              status === "alarming" &&
                "border-destructive bg-destructive/10 text-destructive",
              status === "watching" &&
                "border-success bg-success/10 text-success",
              status === "idle" &&
                "border-border bg-muted text-muted-foreground",
            )}
          >
            {status === "alarming" ? (
              <AlertTriangle className="h-7 w-7" />
            ) : status === "watching" ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : (
              <Anchor className="h-7 w-7" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-2xl">
              {status === "alarming"
                ? "ANCHOR DRAGGING"
                : status === "watching"
                  ? "Anchored — watching"
                  : "Idle"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {status === "alarming"
                ? "Outside swing circle. Check anchor immediately."
                : status === "watching" && anchor
                  ? `Dropped ${formatTime(anchor.droppedAt)} · radius ${anchor.radiusMeters}m`
                  : "Drop the anchor when you're set."}
            </p>
          </div>
        </div>

        {/* Distance vs radius readout */}
        {status !== "idle" && distance !== null && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="text-2xl font-bold tabular-nums">
                {distance.toFixed(1)}
                <span className="text-sm text-muted-foreground"> m</span>
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Radius</p>
              <p className="text-2xl font-bold tabular-nums">
                {anchor?.radiusMeters ?? 0}
                <span className="text-sm text-muted-foreground"> m</span>
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">GPS ±</p>
              <p className="text-2xl font-bold tabular-nums">
                {accuracy !== null ? accuracy.toFixed(0) : "—"}
                <span className="text-sm text-muted-foreground"> m</span>
              </p>
            </div>
          </div>
        )}

        {/* SVG swing-circle visualization */}
        {anchor && current && (
          <SwingCircle
            radiusMeters={anchor.radiusMeters}
            distanceMeters={distance ?? 0}
            bearing={bearingDeg(
              anchor.anchorLat,
              anchor.anchorLon,
              current.lat,
              current.lon,
            )}
            alarming={status === "alarming"}
          />
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2 justify-end">
          {status === "alarming" && (
            <Button onClick={onAcknowledge} variant="outline">
              <BellOff className="h-4 w-4 mr-2" />
              Silence alarm
            </Button>
          )}
          {status === "idle" ? (
            <Button
              onClick={onDrop}
              disabled={!supported || permissionDenied}
              className="font-semibold"
            >
              <Anchor className="h-4 w-4 mr-2" />
              Drop anchor
            </Button>
          ) : (
            <Button onClick={onWeigh} variant="outline">
              <RotateCw className="h-4 w-4 mr-2" />
              Weigh anchor
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

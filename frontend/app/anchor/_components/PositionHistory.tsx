import { Card, CardContent } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { formatTime, type AnchorState, type PositionReading } from "./lib";

export function PositionHistory({
  history,
  anchor,
}: {
  history: PositionReading[];
  anchor: AnchorState | null;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-5 py-4 border-b border-border">
          <p className="font-medium text-sm">Recent positions</p>
          <p className="text-xs text-muted-foreground">
            {history.length} reading
            {history.length === 1 ? "" : "s"} since drop.
          </p>
        </div>
        <ul className="divide-y divide-border max-h-72 overflow-y-auto">
          {history
            .slice(-30)
            .reverse()
            .map((p, i) => {
              const outside =
                anchor &&
                p.distanceFromAnchorM - p.accuracyM > anchor.radiusMeters;
              return (
                <li
                  key={`${p.timestamp}-${i}`}
                  className="px-5 py-2 flex items-center gap-3 text-xs"
                >
                  <span className="text-muted-foreground font-mono w-20">
                    {formatTime(p.timestamp)}
                  </span>
                  <span
                    className={cn(
                      "font-mono w-16 text-right tabular-nums",
                      outside && "text-destructive font-semibold",
                    )}
                  >
                    {p.distanceFromAnchorM.toFixed(1)} m
                  </span>
                  <span className="text-muted-foreground font-mono">
                    ±{p.accuracyM.toFixed(0)} m
                  </span>
                  {outside && (
                    <span className="ml-auto text-destructive text-xs">
                      outside
                    </span>
                  )}
                </li>
              );
            })}
        </ul>
      </CardContent>
    </Card>
  );
}

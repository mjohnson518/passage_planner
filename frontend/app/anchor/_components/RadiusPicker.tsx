import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

// Anchor scope is typically 5:1 to 7:1 of depth. Presets cover quiet
// anchorage / typical / crowded. UI also surfaces "your depth × 1.5 + 15m
// buffer" math so users size the radius for their actual situation.
const RADIUS_PRESETS = [20, 50, 80] as const;

export function RadiusPicker({
  radius,
  onRadiusChange,
}: {
  radius: number;
  onRadiusChange: (value: number) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <p className="font-medium text-sm">Swing radius: {radius} m</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aim for{" "}
            <span className="font-mono">
              1.5 × scope × depth + 15m GPS buffer
            </span>
            . Tight anchorages may need smaller; deep or windy anchorages need
            more.
          </p>
        </div>
        <input
          type="range"
          min="10"
          max="150"
          step="5"
          value={radius}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label="Anchor alarm radius in meters"
        />
        <div className="flex gap-2">
          {RADIUS_PRESETS.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={radius === r ? "default" : "outline"}
              onClick={() => onRadiusChange(r)}
            >
              {r} m
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

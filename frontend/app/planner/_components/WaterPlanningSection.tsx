import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface WaterPlanningSectionProps {
  waterCapacity: number;
  crewSize: number;
  passagePlan: PassagePlanningResponse | null;
  onWaterCapacityChange: (value: number) => void;
  onCrewSizeChange: (value: number) => void;
}

export function WaterPlanningSection({
  waterCapacity,
  crewSize,
  passagePlan,
  onWaterCapacityChange,
  onCrewSizeChange,
}: WaterPlanningSectionProps) {
  return (
    <div>
      <p className="font-semibold text-sm mb-3">Water Planning</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="waterCapacity" className="text-xs">
            Tank Capacity (gal)
          </Label>
          <Input
            id="waterCapacity"
            type="number"
            min="0"
            step="1"
            value={waterCapacity || ""}
            placeholder="e.g., 100"
            onChange={(e) =>
              onWaterCapacityChange(parseFloat(e.target.value) || 0)
            }
          />
        </div>
        <div>
          <Label htmlFor="crewSize" className="text-xs">
            Crew Size
          </Label>
          <Input
            id="crewSize"
            type="number"
            min="1"
            max="20"
            value={crewSize || 2}
            onChange={(e) => onCrewSizeChange(parseInt(e.target.value) || 2)}
          />
        </div>
      </div>
      {waterCapacity > 0 && (
        <div className="mt-2 p-3 bg-muted/30 rounded text-sm space-y-1">
          <p>
            Water per person/day: <strong>1 gallon (min)</strong>
          </p>
          <p>
            Water needed (est):{" "}
            <strong>
              {passagePlan
                ? (
                    (passagePlan.route.estimatedDurationHours / 24) *
                    (crewSize || 2)
                  ).toFixed(1)
                : "---"}{" "}
              gal
            </strong>
          </p>
          <p>
            30% reserve:{" "}
            <strong>
              {passagePlan
                ? (
                    (passagePlan.route.estimatedDurationHours / 24) *
                    (crewSize || 2) *
                    1.3
                  ).toFixed(1)
                : "---"}{" "}
              gal
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}

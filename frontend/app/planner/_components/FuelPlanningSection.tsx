import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface FuelPlanningSectionProps {
  fuelCapacity: number;
  fuelRate: number;
  cruiseSpeed: number;
  passagePlan: PassagePlanningResponse | null;
  onFuelCapacityChange: (value: number) => void;
  onFuelRateChange: (value: number) => void;
}

export function FuelPlanningSection({
  fuelCapacity,
  fuelRate,
  cruiseSpeed,
  passagePlan,
  onFuelCapacityChange,
  onFuelRateChange,
}: FuelPlanningSectionProps) {
  return (
    <div>
      <p className="font-semibold text-sm mb-3">Fuel Planning</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fuelCapacity" className="text-xs">
            Tank Capacity (gal)
          </Label>
          <Input
            id="fuelCapacity"
            type="number"
            min="0"
            step="1"
            value={fuelCapacity || ""}
            placeholder="e.g., 80"
            onChange={(e) =>
              onFuelCapacityChange(parseFloat(e.target.value) || 0)
            }
          />
        </div>
        <div>
          <Label htmlFor="fuelRate" className="text-xs">
            Consumption (gal/hr)
          </Label>
          <Input
            id="fuelRate"
            type="number"
            min="0"
            step="0.1"
            value={fuelRate || ""}
            placeholder="e.g., 2.5"
            onChange={(e) => onFuelRateChange(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>
      {fuelCapacity > 0 && fuelRate > 0 && (
        <div className="mt-2 p-3 bg-muted/30 rounded text-sm space-y-1">
          <p>
            Range at cruise:{" "}
            <strong>
              {((fuelCapacity / fuelRate) * cruiseSpeed).toFixed(0)} nm
            </strong>
          </p>
          <p>
            Fuel needed (est):{" "}
            <strong>
              {passagePlan
                ? (passagePlan.route.estimatedDurationHours * fuelRate).toFixed(
                    1,
                  )
                : "---"}{" "}
              gal
            </strong>
          </p>
          <p>
            30% reserve:{" "}
            <strong>
              {passagePlan
                ? (
                    passagePlan.route.estimatedDurationHours *
                    fuelRate *
                    1.3
                  ).toFixed(1)
                : "---"}{" "}
              gal
            </strong>
          </p>
          {passagePlan &&
            fuelCapacity <
              passagePlan.route.estimatedDurationHours * fuelRate * 1.3 && (
              <p className="text-destructive font-semibold">
                Insufficient fuel with 30% reserve!
              </p>
            )}
        </div>
      )}
    </div>
  );
}

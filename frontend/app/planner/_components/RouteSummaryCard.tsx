import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Compass } from "lucide-react";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface RouteSummaryCardProps {
  passagePlan: PassagePlanningResponse;
}

export function RouteSummaryCard({ passagePlan }: RouteSummaryCardProps) {
  return (
    <Card data-testid="planner-route-results">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="h-5 w-5" />
          1. Route Calculations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Distance</p>
            <p className="text-xl font-bold">{passagePlan.route.distance} nm</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="text-xl font-bold">
              {passagePlan.route.estimatedDuration}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Bearing</p>
            <p className="text-xl font-bold">
              {passagePlan.route.bearing.toFixed(0)}°
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Speed</p>
            <p className="text-xl font-bold">
              {passagePlan.weatherRoute?.averageSpeed ??
                passagePlan.summary.averageSpeed ??
                "N/A"}
            </p>
          </div>
        </div>
        {passagePlan.weatherRoute?.usedPolar && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary border border-primary/30 px-2.5 py-1 text-xs font-medium">
            <span>⛵</span>
            Polar-tuned route ·{" "}
            <span className="font-mono">
              {passagePlan.weatherRoute.usedPolar.name}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Calendar } from "lucide-react";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface TidalResultsCardProps {
  passagePlan: PassagePlanningResponse;
}

export function TidalResultsCard({ passagePlan }: TidalResultsCardProps) {
  return (
    <Card data-testid="planner-tidal-results">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          3. Tidal Predictions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="font-semibold mb-2">Departure Tides</p>
            <p className="text-sm">
              <strong>Station:</strong> {passagePlan.tidal.departure.station}
            </p>
            <p className="text-sm">
              <strong>Next Tide:</strong>{" "}
              {passagePlan.tidal.departure.nextTideFormatted}
            </p>
            {passagePlan.tidal.departure.predictions.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {passagePlan.tidal.departure.predictions.length} predictions
                available
              </p>
            )}
          </div>
          <div>
            <p className="font-semibold mb-2">Destination Tides</p>
            <p className="text-sm">
              <strong>Station:</strong> {passagePlan.tidal.destination.station}
            </p>
            <p className="text-sm">
              <strong>Next Tide:</strong>{" "}
              {passagePlan.tidal.destination.nextTideFormatted}
            </p>
            {passagePlan.tidal.destination.predictions.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {passagePlan.tidal.destination.predictions.length} predictions
                available
              </p>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Source: {passagePlan.tidal.departure.source}
        </p>
      </CardContent>
    </Card>
  );
}

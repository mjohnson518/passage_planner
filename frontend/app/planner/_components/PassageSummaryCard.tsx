import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface PassageSummaryCardProps {
  passagePlan: PassagePlanningResponse;
}

export function PassageSummaryCard({ passagePlan }: PassageSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Passage Summary & Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-semibold mb-2">Route Summary:</p>
          <p className="text-sm">
            {passagePlan.summary.totalDistance} in{" "}
            {passagePlan.summary.estimatedTime}
          </p>
        </div>

        {passagePlan.summary.recommendations.length > 0 && (
          <div>
            <p className="font-semibold mb-2">📋 All Recommendations:</p>
            <ul className="text-sm space-y-1">
              {passagePlan.summary.recommendations.map((rec: string) => (
                <li key={rec} className="text-muted-foreground">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-3 border-t text-xs text-muted-foreground">
          <p>
            <strong>Data Sources:</strong> Route (geolib), Weather (NOAA), Tidal
            (NOAA), Navigation Warnings, Safety Analysis, Port Information
          </p>
          <p>
            <strong>Generated:</strong>{" "}
            {passagePlan.timestamp
              ? new Date(passagePlan.timestamp).toLocaleString() +
                " (plan time)"
              : "Unknown"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

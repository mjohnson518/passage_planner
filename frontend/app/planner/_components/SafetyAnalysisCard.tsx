import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { CheckCircle2 } from "lucide-react";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface SafetyAnalysisCardProps {
  passagePlan: PassagePlanningResponse;
}

export function SafetyAnalysisCard({ passagePlan }: SafetyAnalysisCardProps) {
  return (
    <Card data-testid="planner-safety-analysis">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          5. Safety Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Hazards Detected</p>
            <p className="text-lg font-bold">
              {passagePlan.safety.analysis.hazardsDetected}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Warnings Active</p>
            <p className="text-lg font-bold">
              {passagePlan.safety.analysis.warningsActive}
            </p>
          </div>
        </div>

        {passagePlan.safety.recommendations.length > 0 && (
          <div>
            <p className="font-semibold mb-2">Safety Recommendations:</p>
            <ul className="text-sm space-y-1">
              {passagePlan.safety.recommendations
                .slice(0, 8)
                .map((rec: string) => (
                  <li key={rec} className="text-muted-foreground">
                    • {rec}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {passagePlan.safety.emergencyContacts && (
          <div className="pt-3 border-t">
            <p className="font-semibold mb-2">Emergency Contact:</p>
            <p className="text-sm">
              {passagePlan.safety.emergencyContacts.emergency.coastGuard.name}
            </p>
            <p className="text-sm">
              VHF:{" "}
              {passagePlan.safety.emergencyContacts.emergency.coastGuard.vhf}
            </p>
            <p className="text-sm">
              Phone:{" "}
              {passagePlan.safety.emergencyContacts.emergency.coastGuard.phone}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

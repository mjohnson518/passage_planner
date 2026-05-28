import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface SafetyDecisionCardProps {
  passagePlan: PassagePlanningResponse;
}

export function SafetyDecisionCard({ passagePlan }: SafetyDecisionCardProps) {
  return (
    <Card
      data-testid="planner-safety-decision"
      className={`border-2 ${
        passagePlan.summary.safetyDecision === "GO"
          ? "border-status-go bg-status-go-bg"
          : passagePlan.summary.safetyDecision === "CAUTION"
            ? "border-status-caution bg-status-caution-bg"
            : "border-status-nogo bg-status-nogo-bg"
      }`}
    >
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          {passagePlan.summary.safetyDecision === "GO" && (
            <CheckCircle2 className="h-8 w-8 text-status-go" />
          )}
          {passagePlan.summary.safetyDecision === "CAUTION" && (
            <AlertCircle className="h-8 w-8 text-status-caution" />
          )}
          {passagePlan.summary.safetyDecision === "NO-GO" && (
            <X className="h-8 w-8 text-status-nogo" />
          )}
          Safety Decision: {passagePlan.summary.safetyDecision}
        </CardTitle>
        <CardDescription className="text-lg">
          Safety Score: {passagePlan.summary.safetyScore} | Risk Level:{" "}
          {passagePlan.summary.overallRisk}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="font-semibold mb-2">Assessment:</p>
            <p className="text-sm">
              {passagePlan.summary.suitableForPassage
                ? "✅ This passage is suitable for departure"
                : "⚠️ Review all warnings before proceeding"}
            </p>
          </div>

          {passagePlan.safety.riskFactors.length > 0 && (
            <div>
              <p className="font-semibold mb-2">
                Risk Factors ({passagePlan.safety.riskFactors.length}):
              </p>
              <ul className="text-sm space-y-1">
                {passagePlan.safety.riskFactors
                  .slice(0, 5)
                  .map((factor: string) => (
                    <li key={factor}>• {factor}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

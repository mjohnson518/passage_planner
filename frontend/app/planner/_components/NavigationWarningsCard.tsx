import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { AlertCircle } from "lucide-react";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface NavigationWarningsCardProps {
  passagePlan: PassagePlanningResponse;
}

export function NavigationWarningsCard({
  passagePlan,
}: NavigationWarningsCardProps) {
  return (
    <Card data-testid="planner-nav-warnings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          4. Navigation Warnings ({passagePlan.navigationWarnings.count})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {passagePlan.navigationWarnings.critical > 0 && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded">
            <p className="font-bold text-destructive">
              ⚠️ {passagePlan.navigationWarnings.critical} CRITICAL WARNING(S)
            </p>
          </div>
        )}

        {passagePlan.navigationWarnings.count > 0 ? (
          <div className="space-y-2">
            {passagePlan.navigationWarnings.warnings
              .slice(0, 5)
              .map((warning: any) => (
                <div
                  key={`${warning.severity}:${warning.title}`}
                  className={`p-3 rounded border ${
                    warning.severity === "critical"
                      ? "bg-destructive/5 border-destructive/20"
                      : warning.severity === "warning"
                        ? "bg-warning/5 border-warning/20"
                        : "bg-primary/5 border-primary/20"
                  }`}
                >
                  <p className="font-semibold text-sm">{warning.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {warning.description}
                  </p>
                  <p className="text-xs mt-1">
                    <strong>Source:</strong> {warning.source}
                  </p>
                </div>
              ))}
            {passagePlan.navigationWarnings.count > 5 && (
              <p className="text-sm text-muted-foreground">
                + {passagePlan.navigationWarnings.count - 5} more warnings
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active navigation warnings
          </p>
        )}
      </CardContent>
    </Card>
  );
}

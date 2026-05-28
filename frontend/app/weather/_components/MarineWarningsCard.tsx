"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { AlertTriangle } from "lucide-react";

export interface MarineWarning {
  id: string;
  type: "gale" | "storm" | "hurricane" | "small-craft";
  severity: "watch" | "warning";
  area: string;
  description: string;
  validFrom: string;
  validUntil: string;
}

const getWarningColor = (type: string, severity: string) => {
  if (severity === "warning") {
    return type === "hurricane" ? "destructive" : "default";
  }
  return "secondary";
};

export function MarineWarningsCard({
  warnings,
}: {
  warnings: MarineWarning[];
}) {
  if (warnings.length === 0) return null;

  return (
    <Card className="border-warning">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" />
          Marine Warnings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {warnings.map((warning) => (
            <div
              key={warning.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted"
            >
              <Badge variant={getWarningColor(warning.type, warning.severity)}>
                {warning.type.replace("-", " ").toUpperCase()}
              </Badge>
              <div className="flex-1">
                <p className="font-medium">{warning.area}</p>
                <p className="text-sm text-muted-foreground">
                  {warning.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valid until{" "}
                  {new Date(warning.validUntil).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

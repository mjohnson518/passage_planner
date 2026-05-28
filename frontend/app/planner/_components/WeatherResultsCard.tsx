import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Ship } from "lucide-react";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface WeatherResultsCardProps {
  passagePlan: PassagePlanningResponse;
  departureLabel: string;
  destinationLabel: string;
}

export function WeatherResultsCard({
  passagePlan,
  departureLabel,
  destinationLabel,
}: WeatherResultsCardProps) {
  return (
    <Card data-testid="planner-weather-results">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ship className="h-5 w-5" />
          2. Weather Conditions
        </CardTitle>
        {/* 3.1 — Weather data timestamp with staleness color coding */}
        {passagePlan.weather?.departure?.issuedAt &&
          (() => {
            const issuedAt = new Date(passagePlan.weather.departure.issuedAt);
            // oxlint-disable-next-line react-doctor/rendering-hydration-mismatch-time -- intentional client-only staleness clock; output renders inside a suppressHydrationWarning <p>.
            const ageMs = Date.now() - issuedAt.getTime();
            const ageMin = Math.round(ageMs / 60000);
            const color =
              ageMs < 30 * 60 * 1000
                ? "text-success"
                : ageMs < 60 * 60 * 1000
                  ? "text-warning"
                  : "text-destructive";
            const staleLabel =
              ageMs >= 60 * 60 * 1000 ? " ⚠ STALE — verify independently" : "";
            return (
              // Client-only relative time (Date.now / toLocaleTimeString) —
              // intentionally differs from any server render.
              <p className={`text-xs mt-1 ${color}`} suppressHydrationWarning>
                Data from: {issuedAt.toLocaleTimeString()} ({ageMin} min ago)
                {staleLabel}
              </p>
            );
          })()}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="font-semibold mb-2">Departure: {departureLabel}</p>
            <div className="space-y-1 text-sm">
              <p>
                <strong>Conditions:</strong>{" "}
                {passagePlan.weather.departure.conditions}
              </p>
              <p>
                <strong>Wind:</strong>{" "}
                {passagePlan.weather.departure.windDescription} kt
              </p>
              <p>
                <strong>Waves:</strong>{" "}
                {passagePlan.weather.departure.waveHeight} ft
              </p>
              <p>
                <strong>Temp:</strong>{" "}
                {passagePlan.weather.departure.temperature}°F
              </p>
              {passagePlan.weather.departure.warnings.length > 0 && (
                <p className="text-warning">
                  <strong>⚠️ Warnings:</strong>{" "}
                  {passagePlan.weather.departure.warnings.join(", ")}
                </p>
              )}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-2">
              Destination: {destinationLabel}
            </p>
            <div className="space-y-1 text-sm">
              <p>
                <strong>Conditions:</strong>{" "}
                {passagePlan.weather.destination.conditions}
              </p>
              <p>
                <strong>Wind:</strong>{" "}
                {passagePlan.weather.destination.windDescription} kt
              </p>
              <p>
                <strong>Waves:</strong>{" "}
                {passagePlan.weather.destination.waveHeight} ft
              </p>
              <p>
                <strong>Temp:</strong>{" "}
                {passagePlan.weather.destination.temperature}°F
              </p>
              {passagePlan.weather.destination.warnings.length > 0 && (
                <p className="text-warning">
                  <strong>⚠️ Warnings:</strong>{" "}
                  {passagePlan.weather.destination.warnings.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="pt-2 border-t">
          <p className="text-sm">
            <strong>Overall:</strong> {passagePlan.weather.summary.overall}
          </p>
          <p className="text-sm text-muted-foreground">
            Source: {passagePlan.weather.departure.source} | Units: kt / ft / °F
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

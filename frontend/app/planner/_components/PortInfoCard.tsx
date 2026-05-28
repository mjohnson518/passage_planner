import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { MapPin } from "lucide-react";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface PortInfoCardProps {
  passagePlan: PassagePlanningResponse;
}

export function PortInfoCard({ passagePlan }: PortInfoCardProps) {
  return (
    <Card data-testid="planner-port-info">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          6. Port Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {/* Departure Port */}
          <div>
            <p className="font-semibold mb-2">Departure Port</p>
            {passagePlan.port.departure.found !== false ? (
              <div className="space-y-1 text-sm">
                <p>
                  <strong>Name:</strong> {passagePlan.port.departure.name}
                </p>
                <p>
                  <strong>Distance:</strong>{" "}
                  {passagePlan.port.departure.distance}
                </p>
                <p>
                  <strong>VHF:</strong> Channel{" "}
                  {passagePlan.port.departure.contact?.vhf}
                </p>
                <p>
                  <strong>Facilities:</strong>{" "}
                  {passagePlan.port.departure.facilities?.fuel ? "⛽" : ""}{" "}
                  {passagePlan.port.departure.facilities?.water ? "💧" : ""}{" "}
                  {passagePlan.port.departure.facilities?.repair ? "🔧" : ""}
                </p>
                {passagePlan.port.departure.customs?.portOfEntry && (
                  <p className="text-primary">
                    <strong>🛂 Port of Entry</strong>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {passagePlan.port.departure.message || "No port nearby"}
              </p>
            )}
          </div>

          {/* Destination Port */}
          <div>
            <p className="font-semibold mb-2">Destination Port</p>
            {passagePlan.port.destination.found !== false ? (
              <div className="space-y-1 text-sm">
                <p>
                  <strong>Name:</strong> {passagePlan.port.destination.name}
                </p>
                <p>
                  <strong>Distance:</strong>{" "}
                  {passagePlan.port.destination.distance}
                </p>
                <p>
                  <strong>VHF:</strong> Channel{" "}
                  {passagePlan.port.destination.contact?.vhf}
                </p>
                <p>
                  <strong>Facilities:</strong>{" "}
                  {passagePlan.port.destination.facilities?.fuel ? "⛽" : ""}{" "}
                  {passagePlan.port.destination.facilities?.water ? "💧" : ""}{" "}
                  {passagePlan.port.destination.facilities?.repair ? "🔧" : ""}
                </p>
                {passagePlan.port.destination.customs?.portOfEntry && (
                  <p className="text-primary">
                    <strong>🛂 Port of Entry</strong>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {passagePlan.port.destination.message || "No port nearby"}
              </p>
            )}
          </div>
        </div>

        {/* Emergency Harbors */}
        {passagePlan.port.emergencyHarbors.length > 0 && (
          <div className="pt-3 border-t">
            <p className="font-semibold mb-2">Emergency Harbors Nearby:</p>
            <div className="space-y-2">
              {passagePlan.port.emergencyHarbors.map((harbor: any) => (
                <div
                  key={harbor.name}
                  className="text-sm flex items-center gap-2"
                >
                  <span className="font-medium">{harbor.name}</span>
                  <span className="text-muted-foreground">
                    ({harbor.distance}) - VHF {harbor.vhf}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

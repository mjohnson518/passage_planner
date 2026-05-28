"use client";

import { Dispatch, SetStateAction } from "react";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { TabsContent } from "../../components/ui/tabs";
import { MapPin, Compass, Plus, X } from "lucide-react";
import PortSelector from "../../components/location/PortSelector";
import type { PlannerFormData } from "./planner-form-types";

interface RouteTabPanelProps {
  formData: PlannerFormData;
  setFormData: Dispatch<SetStateAction<PlannerFormData>>;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (id: string) => void;
  onUpdateWaypoint: (id: string, name: string) => void;
}

export function RouteTabPanel({
  formData,
  setFormData,
  onAddWaypoint,
  onRemoveWaypoint,
  onUpdateWaypoint,
}: RouteTabPanelProps) {
  return (
    <TabsContent value="route" className="mt-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Route Planning</CardTitle>
        <CardDescription>
          Define your departure, destination, and any waypoints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="departure">Departure Port *</Label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              <PortSelector
                data-testid="planner-departure"
                value={formData.departure}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, departure: value }))
                }
                onPortSelected={(port) => {
                  setFormData((prev) => ({
                    ...prev,
                    departure: port.name,
                    departureCoords: {
                      latitude: port.lat,
                      longitude: port.lng,
                    },
                  }));
                }}
                placeholder="Type port name (e.g., Miami, Gibraltar, Singapore)"
                className="pl-10"
                id="departure"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="destination">Destination Port *</Label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              <PortSelector
                data-testid="planner-destination"
                value={formData.destination}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, destination: value }))
                }
                onPortSelected={(port) => {
                  setFormData((prev) => ({
                    ...prev,
                    destination: port.name,
                    destinationCoords: {
                      latitude: port.lat,
                      longitude: port.lng,
                    },
                  }));
                }}
                placeholder="Type port name (e.g., Charleston, Athens, Hong Kong)"
                className="pl-10"
                id="destination"
              />
            </div>
          </div>
        </div>

        {/* Waypoints */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Waypoints (Optional)</Label>
            <Button
              type="button"
              data-testid="planner-add-waypoint"
              variant="outline"
              size="sm"
              onClick={onAddWaypoint}
              className="h-8"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

          {formData.waypoints.length > 0 ? (
            <div className="space-y-2">
              {formData.waypoints.map((waypoint, index) => (
                <div key={waypoint.id} className="flex gap-2">
                  <div className="flex-1 relative">
                    <Compass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Waypoint ${index + 1}`}
                      value={waypoint.name}
                      onChange={(e) =>
                        onUpdateWaypoint(waypoint.id, e.target.value)
                      }
                      className="pl-10"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveWaypoint(waypoint.id)}
                    className="h-10 w-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No waypoints added. Add waypoints for specific routing.
            </p>
          )}
        </div>
      </CardContent>
    </TabsContent>
  );
}

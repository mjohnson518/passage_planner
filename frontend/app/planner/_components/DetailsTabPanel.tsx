"use client";

import { Dispatch, SetStateAction } from "react";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { TabsContent } from "../../components/ui/tabs";
import { DatePicker } from "../../components/ui/date-picker";
import type { PlannerFormData } from "./planner-form-types";

interface DetailsTabPanelProps {
  formData: PlannerFormData;
  setFormData: Dispatch<SetStateAction<PlannerFormData>>;
}

export function DetailsTabPanel({
  formData,
  setFormData,
}: DetailsTabPanelProps) {
  return (
    <TabsContent value="details" className="mt-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Passage Details</CardTitle>
        <CardDescription>
          Set departure time and select your boat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The default departure date is `new Date()` (client "now"),
            which the DatePicker renders as a formatted string — that is
            intentionally client-specific, so the hydration mismatch on
            the rendered date text is expected and suppressed here. */}
        <div suppressHydrationWarning>
          <Label htmlFor="departure-date">Departure Date & Time *</Label>
          <DatePicker
            date={formData.departureDate}
            onDateChange={(date) =>
              setFormData((prev) => ({
                ...prev,
                // oxlint-disable-next-line react-doctor/rendering-hydration-mismatch-time -- runs in an event handler, not on the render path.
                departureDate: date || new Date(),
              }))
            }
          />
        </div>

        <div>
          <Label htmlFor="boat">Boat Type *</Label>
          <select
            id="boat"
            data-testid="planner-boat-type"
            value={formData.boat}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, boat: e.target.value }))
            }
            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Choose boat type…</option>
            <option value="sailboat">Sailboat</option>
            <option value="powerboat">Powerboat</option>
            <option value="catamaran">Catamaran</option>
            <option value="trimaran">Trimaran</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cruise-speed">Cruise Speed (kts)</Label>
            <Input
              id="cruise-speed"
              data-testid="planner-cruise-speed"
              type="number"
              min="1"
              max="30"
              value={formData.cruiseSpeed}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  cruiseSpeed: parseFloat(e.target.value) || 6,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="max-speed">Max Speed (kts)</Label>
            <Input
              id="max-speed"
              type="number"
              min="1"
              max="40"
              value={formData.maxSpeed}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  maxSpeed: parseFloat(e.target.value) || 8,
                }))
              }
            />
          </div>
        </div>

        <div>
          <Label htmlFor="draft">Vessel Draft (feet)</Label>
          <Input
            id="draft"
            data-testid="planner-draft"
            type="number"
            min="0.5"
            max="40"
            step="0.1"
            value={formData.draft || ""}
            placeholder="e.g., 5.5"
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                draft: parseFloat(e.target.value) || 0,
              }))
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Used for under-keel clearance calculations. Defaults to 5.5ft if not
            set.
          </p>
        </div>
      </CardContent>
    </TabsContent>
  );
}

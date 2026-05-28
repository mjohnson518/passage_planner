"use client";

import { Dispatch, SetStateAction } from "react";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { TabsContent } from "../../components/ui/tabs";
import { FuelPlanningSection } from "./FuelPlanningSection";
import { WaterPlanningSection } from "./WaterPlanningSection";
import { PreDepartureChecklist } from "./PreDepartureChecklist";
import type { PlannerFormData } from "./planner-form-types";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface PreferencesTabPanelProps {
  formData: PlannerFormData;
  setFormData: Dispatch<SetStateAction<PlannerFormData>>;
  passagePlan: PassagePlanningResponse | null;
}

export function PreferencesTabPanel({
  formData,
  setFormData,
  passagePlan,
}: PreferencesTabPanelProps) {
  return (
    <TabsContent value="preferences" className="mt-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Vessel & Provisioning</CardTitle>
        <CardDescription>
          Fuel, water, and provisioning calculations with 30% safety reserves
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fuel Calculator */}
        <FuelPlanningSection
          fuelCapacity={formData.fuelCapacity}
          fuelRate={formData.fuelRate}
          cruiseSpeed={formData.cruiseSpeed}
          passagePlan={passagePlan}
          onFuelCapacityChange={(value) =>
            setFormData((prev) => ({ ...prev, fuelCapacity: value }))
          }
          onFuelRateChange={(value) =>
            setFormData((prev) => ({ ...prev, fuelRate: value }))
          }
        />

        {/* Water Calculator */}
        <WaterPlanningSection
          waterCapacity={formData.waterCapacity}
          crewSize={formData.crewSize}
          passagePlan={passagePlan}
          onWaterCapacityChange={(value) =>
            setFormData((prev) => ({ ...prev, waterCapacity: value }))
          }
          onCrewSizeChange={(value) =>
            setFormData((prev) => ({ ...prev, crewSize: value }))
          }
        />

        {/* Pre-Departure Checklist */}
        <PreDepartureChecklist
          checklist={formData.checklist}
          onToggle={(id, checked) =>
            setFormData((prev) => ({
              ...prev,
              checklist: {
                ...prev.checklist,
                [id]: checked,
              },
            }))
          }
        />
      </CardContent>
    </TabsContent>
  );
}

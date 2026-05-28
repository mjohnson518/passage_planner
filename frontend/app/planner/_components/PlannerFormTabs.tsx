"use client";

import { Dispatch, SetStateAction } from "react";
import { Card } from "../../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { MapPin, Calendar, Ship } from "lucide-react";
import { RouteTabPanel } from "./RouteTabPanel";
import { DetailsTabPanel } from "./DetailsTabPanel";
import { PreferencesTabPanel } from "./PreferencesTabPanel";
import type { PlannerFormData } from "./planner-form-types";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface PlannerFormTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  formData: PlannerFormData;
  setFormData: Dispatch<SetStateAction<PlannerFormData>>;
  passagePlan: PassagePlanningResponse | null;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (id: string) => void;
  onUpdateWaypoint: (id: string, name: string) => void;
}

export function PlannerFormTabs({
  activeTab,
  onTabChange,
  formData,
  setFormData,
  passagePlan,
  onAddWaypoint,
  onRemoveWaypoint,
  onUpdateWaypoint,
}: PlannerFormTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6 h-auto p-1">
        <TabsTrigger
          data-testid="planner-tab-route"
          value="route"
          className="text-xs sm:text-sm py-2 data-[state=active]:shadow-maritime"
        >
          <MapPin className="h-4 w-4 mr-1.5 sm:mr-2" />
          Route
        </TabsTrigger>
        <TabsTrigger
          data-testid="planner-tab-details"
          value="details"
          className="text-xs sm:text-sm py-2 data-[state=active]:shadow-maritime"
        >
          <Calendar className="h-4 w-4 mr-1.5 sm:mr-2" />
          Details
        </TabsTrigger>
        <TabsTrigger
          data-testid="planner-tab-preferences"
          value="preferences"
          className="text-xs sm:text-sm py-2 data-[state=active]:shadow-maritime"
        >
          <Ship className="h-4 w-4 mr-1.5 sm:mr-2" />
          Preferences
        </TabsTrigger>
      </TabsList>

      <Card>
        <RouteTabPanel
          formData={formData}
          setFormData={setFormData}
          onAddWaypoint={onAddWaypoint}
          onRemoveWaypoint={onRemoveWaypoint}
          onUpdateWaypoint={onUpdateWaypoint}
        />
        <DetailsTabPanel formData={formData} setFormData={setFormData} />
        <PreferencesTabPanel
          formData={formData}
          setFormData={setFormData}
          passagePlan={passagePlan}
        />
      </Card>
    </Tabs>
  );
}

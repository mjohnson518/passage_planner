"use client";

import { DepartureComparisonCards } from "../../components/planner/DepartureComparisonCards";
import { RiskScoreCard } from "../../components/planner/RiskScoreCard";
import { ModelAgreementCard } from "../../components/planner/ModelAgreementCard";
import { PlannerSafetyBanners } from "./PlannerSafetyBanners";
import { SafetyDecisionCard } from "./SafetyDecisionCard";
import { RouteSummaryCard } from "./RouteSummaryCard";
import { WeatherResultsCard } from "./WeatherResultsCard";
import { TidalResultsCard } from "./TidalResultsCard";
import { NavigationWarningsCard } from "./NavigationWarningsCard";
import { SafetyAnalysisCard } from "./SafetyAnalysisCard";
import { PortInfoCard } from "./PortInfoCard";
import { RouteVisualizationCard } from "./RouteVisualizationCard";
import { PassageSummaryCard } from "./PassageSummaryCard";
import type { PlannerFormData } from "./planner-form-types";
import type {
  PassagePlanningResponse,
  CompareResponse,
} from "../../../lib/services/passagePlanningService";

interface PlannerResultsProps {
  passagePlan: PassagePlanningResponse;
  connected: boolean;
  comparison: CompareResponse | null;
  selectedCompareIndex: number | null;
  formData: PlannerFormData;
  savedPassageId: string | null;
  onSelectCompare: (idx: number) => void;
  onSaved: (id: string) => void;
}

export function PlannerResults({
  passagePlan,
  connected,
  comparison,
  selectedCompareIndex,
  formData,
  savedPassageId,
  onSelectCompare,
  onSaved,
}: PlannerResultsProps) {
  return (
    <>
      {/* Persistent WebSocket connection status — always visible when a plan is displayed */}
      <div
        className={`text-xs px-3 py-1.5 rounded mb-2 flex items-center gap-2 ${connected ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-destructive"}`}
        />
        {connected
          ? "Live updates connected"
          : "Disconnected — data may be stale"}
      </div>

      {/* Passage Plan Results - All 6 Data Sources */}
      <div className="space-y-6 mb-6">
        <PlannerSafetyBanners passagePlan={passagePlan} />

        {/* Safety Decision - PROMINENT DISPLAY */}
        <SafetyDecisionCard passagePlan={passagePlan} />

        {/* Route Summary */}
        <RouteSummaryCard passagePlan={passagePlan} />

        {/* R3 — Multi-window comparison cards. Shown above the single-plan
            detail so the sailor sees the trade-offs first, then dives into
            whichever window they pick. */}
        {comparison && (
          <DepartureComparisonCards
            comparison={comparison}
            selectedIndex={selectedCompareIndex}
            onSelect={onSelectCompare}
          />
        )}

        {/* R2 — Composite risk score hero card. Always rendered when the
            backend produced a score (i.e. for every authenticated plan).
            Decision support, not a decision — the disclaimers inside the
            card make that contract explicit. */}
        {passagePlan.riskScore && (
          <RiskScoreCard riskScore={passagePlan.riskScore} />
        )}

        {/* R1 — Multi-model agreement (Premium). Shown when the user
            requested multi-model AND the server returned data; otherwise the
            card surfaces the upsell teaser. */}
        {(passagePlan.modelComparison || passagePlan.modelComparisonGated) && (
          <ModelAgreementCard
            comparison={passagePlan.modelComparison ?? null}
            gated={passagePlan.modelComparisonGated === true}
          />
        )}

        {/* Weather Data */}
        <WeatherResultsCard
          passagePlan={passagePlan}
          departureLabel={formData.departure}
          destinationLabel={formData.destination}
        />

        {/* Tidal Data */}
        <TidalResultsCard passagePlan={passagePlan} />

        {/* Navigation Warnings */}
        <NavigationWarningsCard passagePlan={passagePlan} />

        {/* Safety Analysis */}
        <SafetyAnalysisCard passagePlan={passagePlan} />

        {/* Port Information */}
        <PortInfoCard passagePlan={passagePlan} />

        {/* Interactive Route Map */}
        <RouteVisualizationCard
          passagePlan={passagePlan}
          departure={formData.departure}
          destination={formData.destination}
          boat={formData.boat}
          departureCoords={formData.departureCoords}
          destinationCoords={formData.destinationCoords}
          savedPassageId={savedPassageId}
          onSaved={onSaved}
        />

        {/* Summary and Recommendations */}
        <PassageSummaryCard passagePlan={passagePlan} />
      </div>
    </>
  );
}

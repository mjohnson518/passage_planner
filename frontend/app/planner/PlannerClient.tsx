"use client";

import RequireAuth from "../components/auth/RequireAuth";
import { DepartureCandidatesInput } from "../components/planner/DepartureCandidatesInput";
import { PlannerHeader } from "./_components/PlannerHeader";
import { AgentStatusCard } from "./_components/AgentStatusCard";
import { PlannerResults } from "./_components/PlannerResults";
import { PlanningOptionsToggles } from "./_components/PlanningOptionsToggles";
import { PlannerActions } from "./_components/PlannerActions";
import { PlannerFormTabs } from "./_components/PlannerFormTabs";
import { usePlannerState } from "./_components/usePlannerState";

function PlannerPageInner() {
  const planner = usePlannerState();

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <PlannerHeader />

      {/* Agent Status Display */}
      {planner.loading && (
        <AgentStatusCard
          connected={planner.connected}
          agentStatuses={planner.agentStatuses}
        />
      )}

      {planner.passagePlan && (
        <PlannerResults
          passagePlan={planner.passagePlan}
          connected={planner.connected}
          comparison={planner.comparison}
          selectedCompareIndex={planner.selectedCompareIndex}
          formData={planner.formData}
          savedPassageId={planner.savedPassageId}
          onSelectCompare={planner.selectCompareCandidate}
          onSaved={planner.setSavedPassageId}
        />
      )}

      {/* Section tabs — labels visible at all breakpoints (icon-only was
          opaque on mobile). Each tab represents a step in the form, not
          alternate views, so the active state needs to stand out. */}
      <PlannerFormTabs
        activeTab={planner.activeTab}
        onTabChange={planner.setActiveTab}
        formData={planner.formData}
        setFormData={planner.setFormData}
        passagePlan={planner.passagePlan}
        onAddWaypoint={planner.addWaypoint}
        onRemoveWaypoint={planner.removeWaypoint}
        onUpdateWaypoint={planner.updateWaypoint}
      />

      {/* R3 — Multi-departure-time comparison (Premium, hard-gated). Renders
          a list of datetime pickers when enabled. */}
      <DepartureCandidatesInput
        enabled={planner.compareEnabled}
        onEnabledChange={planner.setCompareEnabled}
        candidates={planner.compareCandidates}
        onCandidatesChange={planner.setCompareCandidates}
        tierLocked={planner.tierLocked}
      />

      <PlanningOptionsToggles
        tierLocked={planner.tierLocked}
        crewCerts={planner.crewCerts}
        crewCheckEnabled={planner.crewCheckEnabled}
        selectedCrewIds={planner.selectedCrewIds}
        onCrewCheckEnabledChange={planner.setCrewCheckEnabled}
        onToggleCrew={planner.toggleCrew}
        polarVessels={planner.polarVessels}
        usePolars={planner.usePolars}
        polarVesselId={planner.polarVesselId}
        onUsePolarsChange={planner.setUsePolars}
        onPolarVesselIdChange={planner.setPolarVesselId}
        multiModel={planner.multiModel}
        onMultiModelChange={planner.setMultiModel}
      />

      {/* Action buttons - Fixed on mobile */}
      <PlannerActions
        loading={planner.loading}
        canSubmit={
          !!planner.formData.departure && !!planner.formData.destination
        }
        onCancel={() => planner.back()}
        onSubmit={planner.handleSubmit}
      />
    </div>
  );
}

export default function PlannerClient() {
  return (
    <RequireAuth>
      <PlannerPageInner />
    </RequireAuth>
  );
}

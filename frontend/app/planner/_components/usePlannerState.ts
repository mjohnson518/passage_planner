"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  planPassage,
  PassagePlanningRequest,
  PassagePlanningResponse,
} from "../../../lib/services/passagePlanningService";
import {
  comparePassages,
  type CompareResponse,
} from "../../../lib/services/passagePlanningService";
import { analytics } from "@/lib/analytics";
import { logger } from "../../lib/logger";
import { isInCoverage } from "../../../lib/coverage";
import { useSocket } from "../../contexts/SocketContext";
import type { PlannerFormData, Waypoint } from "./planner-form-types";

// --- Planning options (opt-in feature toggles) -----------------------------
// These flags/selections are conceptually one slice ("how should this passage
// be planned?") and several change together as the user configures a run, so
// they live in a single reducer. Behavior is identical to the prior
// independent useState hooks — each action sets exactly one field, except
// `toggleCrew` which mirrors the previous functional Set update.
interface PlanningOptionsState {
  multiModel: boolean;
  usePolars: boolean;
  polarVesselId: string;
  crewCheckEnabled: boolean;
  selectedCrewIds: Set<string>;
  compareEnabled: boolean;
  compareCandidates: string[];
}

type PlanningOptionsAction =
  | { type: "setMultiModel"; value: boolean }
  | { type: "setUsePolars"; value: boolean }
  | { type: "setPolarVesselId"; value: string }
  | { type: "initPolarVesselId"; value: string }
  | { type: "setCrewCheckEnabled"; value: boolean }
  | { type: "toggleCrew"; id: string; checked: boolean }
  | { type: "setCompareEnabled"; value: boolean }
  | { type: "setCompareCandidates"; value: string[] };

const initialPlanningOptions: PlanningOptionsState = {
  multiModel: false,
  usePolars: false,
  polarVesselId: "",
  crewCheckEnabled: false,
  selectedCrewIds: new Set(),
  compareEnabled: false,
  compareCandidates: [],
};

function planningOptionsReducer(
  state: PlanningOptionsState,
  action: PlanningOptionsAction,
): PlanningOptionsState {
  switch (action.type) {
    case "setMultiModel":
      return { ...state, multiModel: action.value };
    case "setUsePolars":
      return { ...state, usePolars: action.value };
    case "setPolarVesselId":
      return { ...state, polarVesselId: action.value };
    case "initPolarVesselId":
      // Preserves "existing || first" — only fills an empty selection.
      return state.polarVesselId
        ? state
        : { ...state, polarVesselId: action.value };
    case "setCrewCheckEnabled":
      return { ...state, crewCheckEnabled: action.value };
    case "toggleCrew": {
      const next = new Set(state.selectedCrewIds);
      if (action.checked) next.add(action.id);
      else next.delete(action.id);
      return { ...state, selectedCrewIds: next };
    }
    case "setCompareEnabled":
      return { ...state, compareEnabled: action.value };
    case "setCompareCandidates":
      return { ...state, compareCandidates: action.value };
    default:
      return state;
  }
}

// --- Plan result (async planning outcome) ----------------------------------
// `loading`, the resolved `passagePlan`, and the R3 multi-window `comparison`
// + selected index are set together at every call site (submit handler and
// the WebSocket update handler), so they form one reducer slice.
interface PlanResultState {
  loading: boolean;
  passagePlan: PassagePlanningResponse | null;
  comparison: CompareResponse | null;
  selectedCompareIndex: number | null;
}

type PlanResultAction =
  | { type: "setLoading"; value: boolean }
  | { type: "setPassagePlan"; value: PassagePlanningResponse | null }
  | { type: "setComparison"; value: CompareResponse | null }
  | { type: "setSelectedCompareIndex"; value: number | null };

const initialPlanResult: PlanResultState = {
  loading: false,
  passagePlan: null,
  comparison: null,
  selectedCompareIndex: null,
};

function planResultReducer(
  state: PlanResultState,
  action: PlanResultAction,
): PlanResultState {
  switch (action.type) {
    case "setLoading":
      return { ...state, loading: action.value };
    case "setPassagePlan":
      return { ...state, passagePlan: action.value };
    case "setComparison":
      return { ...state, comparison: action.value };
    case "setSelectedCompareIndex":
      return { ...state, selectedCompareIndex: action.value };
    default:
      return state;
  }
}

export function usePlannerState() {
  const { connected, agentStatuses, subscribe, unsubscribe } = useSocket();
  const { back } = useRouter();
  const [activeTab, setActiveTab] = useState("route");
  // The Redis-side passage id captured from POST /api/passages once the user
  // saves the plan. Drives the Send Float Plan button (S1) — disabled until
  // the user saves, since float plans need a stable passage id to reference.
  const [savedPassageId, setSavedPassageId] = useState<string | null>(null);

  // Async planning outcome (loading / resolved plan / R3 comparison). One
  // reducer because these are set together at every call site.
  const [planResult, dispatchPlanResult] = useReducer(
    planResultReducer,
    initialPlanResult,
  );
  const { loading, passagePlan, comparison, selectedCompareIndex } = planResult;
  const setLoading = (value: boolean) =>
    dispatchPlanResult({ type: "setLoading", value });
  const setPassagePlan = (value: PassagePlanningResponse | null) =>
    dispatchPlanResult({ type: "setPassagePlan", value });
  const setComparison = (value: CompareResponse | null) =>
    dispatchPlanResult({ type: "setComparison", value });
  const setSelectedCompareIndex = (value: number | null) =>
    dispatchPlanResult({ type: "setSelectedCompareIndex", value });

  // Opt-in planning options (R1 multi-model, V1 polar, F1 crew, R3 compare).
  // Grouped into one reducer — see planningOptionsReducer above.
  const [options, dispatchOptions] = useReducer(
    planningOptionsReducer,
    initialPlanningOptions,
  );
  const {
    multiModel,
    usePolars,
    polarVesselId,
    crewCheckEnabled,
    selectedCrewIds,
    compareEnabled,
    compareCandidates,
  } = options;
  const setMultiModel = (value: boolean) =>
    dispatchOptions({ type: "setMultiModel", value });
  const setUsePolars = (value: boolean) =>
    dispatchOptions({ type: "setUsePolars", value });
  const setPolarVesselId = (value: string) =>
    dispatchOptions({ type: "setPolarVesselId", value });
  const setCrewCheckEnabled = (value: boolean) =>
    dispatchOptions({ type: "setCrewCheckEnabled", value });
  const setCompareEnabled = (value: boolean) =>
    dispatchOptions({ type: "setCompareEnabled", value });
  const setCompareCandidates = (value: string[]) =>
    dispatchOptions({ type: "setCompareCandidates", value });
  const toggleCrew = (id: string, checked: boolean) =>
    dispatchOptions({ type: "toggleCrew", id, checked });
  // Tier check for the compare feature (hard gate). Fetched once on mount via
  // react-query. Fails closed: `tierLocked` is true while the query is
  // loading and on any error (non-ok response or thrown), matching the prior
  // useState(true) default + fail-closed catch behavior.
  const { data: tierData } = useQuery({
    queryKey: ["planner", "profile-tier"],
    queryFn: async () => {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { subscription_tier?: string };
    },
  });
  const tierLocked = (tierData?.subscription_tier ?? "free") === "free";
  // V1 — fetch the user's vessel list once we know they're Premium. Polar
  // routing requires picking a vessel; the checkbox UI gates on a non-empty
  // vessel list. Best-effort — polar checkbox just won't render if vessels
  // fail to load (query disabled while tier-locked).
  const { data: vesselsData } = useQuery({
    queryKey: ["planner", "vessels"],
    enabled: !tierLocked,
    queryFn: async () => {
      const res = await fetch("/api/vessels", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as {
        vessels: Array<{ id: string; name: string }>;
      };
    },
  });
  const polarVessels = vesselsData?.vessels ?? [];
  // Initialize the polar vessel selection to the first vessel once the list
  // loads (preserves prior "existing || data.vessels[0].id" behavior).
  useEffect(() => {
    const first = vesselsData?.vessels?.[0]?.id;
    if (first) {
      dispatchOptions({ type: "initPolarVesselId", value: first });
    }
  }, [vesselsData]);
  // F1 — fetch crew certs (Pro only); returns 403 on Premium/Free, which
  // we treat as "no certs tracked" so the checkbox simply won't render.
  // Best-effort — UI hides if fetch fails (query disabled while tier-locked).
  const { data: crewData } = useQuery({
    queryKey: ["planner", "crew-certifications"],
    enabled: !tierLocked,
    queryFn: async () => {
      const res = await fetch("/api/account/crew-certifications", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as {
        certifications: Array<{
          id: string;
          crew_name: string | null;
          cert_type: string;
          cert_label: string | null;
          expiry_date: string;
        }>;
      };
    },
  });
  const crewCerts = crewData?.certifications ?? [];

  const [formData, setFormData] = useState<PlannerFormData>({
    departure: "",
    destination: "",
    departureCoords: { latitude: 0, longitude: 0 }, // Will be set by autocomplete
    destinationCoords: { latitude: 0, longitude: 0 }, // Will be set by autocomplete
    departureDate: new Date(),
    boat: "",
    cruiseSpeed: 6,
    maxSpeed: 8,
    draft: 0,
    fuelCapacity: 0,
    fuelRate: 0,
    waterCapacity: 0,
    crewSize: 2,
    checklist: {} as Record<string, boolean>,
    waypoints: [] as Waypoint[],
  });

  // Hold the latest departure/destination labels in a ref so the WebSocket
  // handler can read fresh values for analytics without re-subscribing on
  // every keystroke. Subscribing once (on subscribe/unsubscribe identity) is
  // the intended behavior; depending on formData would tear down and rebuild
  // the subscription on each form change.
  const formLabelsRef = useRef({
    departure: formData.departure,
    destination: formData.destination,
  });
  formLabelsRef.current = {
    departure: formData.departure,
    destination: formData.destination,
  };

  // Subscribe to WebSocket updates
  useEffect(() => {
    const handleUpdate = (update: any) => {
      switch (update.type) {
        case "planning_started":
          toast.info(
            "Planning started - AI agents are working on your passage plan",
          );
          break;
        case "agent_active":
          toast.info(`${update.agent}: ${update.status}`);
          break;
        case "planning_completed":
          setPassagePlan(update.plan);
          setLoading(false);
          toast.success("Passage plan complete!");

          // Track successful passage creation
          analytics.trackPassageCreated({
            distance_nm: update.plan?.summary?.totalDistance,
            duration_hours: update.plan?.summary?.estimatedDuration,
            waypoint_count: update.plan?.route?.waypoints?.length,
            departure_port: formLabelsRef.current.departure,
            destination_port: formLabelsRef.current.destination,
          });
          break;
        case "planning_error":
          setLoading(false);
          toast.error(`Planning failed: ${update.error}`);
          break;
      }
    };

    subscribe(handleUpdate);
    return () => unsubscribe(handleUpdate);
  }, [subscribe, unsubscribe]);

  const addWaypoint = () => {
    const newWaypoint: Waypoint = {
      id: Date.now().toString(),
      name: "",
    };
    setFormData((prev) => ({
      ...prev,
      waypoints: [...prev.waypoints, newWaypoint],
    }));
  };

  const removeWaypoint = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      waypoints: prev.waypoints.filter((w) => w.id !== id),
    }));
  };

  const updateWaypoint = (id: string, name: string) => {
    setFormData((prev) => ({
      ...prev,
      waypoints: prev.waypoints.map((w) => (w.id === id ? { ...w, name } : w)),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.departure || !formData.destination) {
      toast.error("Please enter departure and destination ports");
      return;
    }

    // Auto-match coordinates if not set
    if (formData.departureCoords.latitude === 0 && formData.departure) {
      toast.error(
        "Could not determine coordinates for departure port. Please select from the dropdown.",
      );
      return;
    }
    if (formData.destinationCoords.latitude === 0 && formData.destination) {
      toast.error(
        "Could not determine coordinates for destination port. Please select from the dropdown.",
      );
      return;
    }

    // Honest scoping: warn (do not block) if either endpoint is outside Helmwise's
    // validated coverage region. The full disclaimer is rendered with the result.
    const departureInCoverage = isInCoverage(
      formData.departureCoords.latitude,
      formData.departureCoords.longitude,
    );
    const destinationInCoverage = isInCoverage(
      formData.destinationCoords.latitude,
      formData.destinationCoords.longitude,
    );
    if (!departureInCoverage || !destinationInCoverage) {
      toast.warning(
        "This passage extends outside Helmwise's validated coverage region. " +
          "Tidal accuracy and hazard detection are degraded — verify with official sources.",
        { duration: 8000 },
      );
    }

    setLoading(true);
    setPassagePlan(null);

    try {
      // Use coordinates from autocomplete or defaults
      const planRequest: PassagePlanningRequest = {
        departure: {
          latitude: formData.departureCoords.latitude,
          longitude: formData.departureCoords.longitude,
          name: formData.departure,
        },
        destination: {
          latitude: formData.destinationCoords.latitude,
          longitude: formData.destinationCoords.longitude,
          name: formData.destination,
        },
        vessel: {
          cruiseSpeed: formData.cruiseSpeed,
          draft: formData.draft > 0 ? formData.draft : 5.5,
          crewExperience: "advanced",
          crewSize: formData.crewSize || 2,
        },
        multiModel,
        usePolars,
        vesselId: usePolars && polarVesselId ? polarVesselId : undefined,
        crewIds:
          crewCheckEnabled && selectedCrewIds.size > 0
            ? Array.from(selectedCrewIds)
            : undefined,
      };

      // R3 — if multi-window comparison is enabled with at least one
      // candidate, fire the compare endpoint and select the "best" window's
      // plan for the main results view.
      if (compareEnabled && !tierLocked && compareCandidates.length > 0) {
        const isoCandidates = compareCandidates
          .map((d) => {
            const t = new Date(d).getTime();
            return Number.isFinite(t) ? new Date(t).toISOString() : null;
          })
          .filter((s): s is string => s !== null);
        if (isoCandidates.length === 0) {
          toast.error("Pick at least one valid departure time.");
          setLoading(false);
          return;
        }
        const cmp = await comparePassages(planRequest, isoCandidates);
        if (cmp.upgradeRequired) {
          toast.error(cmp.summary?.[0] ?? "Premium subscription required.");
          setLoading(false);
          return;
        }
        setComparison(cmp);
        const initialIdx =
          cmp.bestIndex ?? cmp.candidates.findIndex((c) => c.status === "ok");
        setSelectedCompareIndex(initialIdx >= 0 ? initialIdx : null);
        const selected = initialIdx >= 0 ? cmp.candidates[initialIdx] : null;
        if (selected && selected.status === "ok") {
          setPassagePlan(selected.plan);
          toast.success(
            `Compared ${cmp.candidates.length} windows. Showing ${cmp.bestIndex === initialIdx ? "best" : "first available"} candidate.`,
          );
        } else {
          toast.error("All candidate plans failed. Check your inputs.");
        }
        setLoading(false);
        return;
      }

      // Standard single-plan flow.
      setComparison(null);
      setSelectedCompareIndex(null);
      const result = await planPassage(planRequest);

      setPassagePlan(result);
      setLoading(false);

      toast.success("Passage plan complete - all 6 data sources loaded!");

      // Track successful passage creation
      analytics.trackPassageCreated({
        distance_nm: result.route.distance,
        duration_hours: result.route.estimatedDurationHours,
        waypoint_count: result.route.waypoints.length,
        departure_port: formData.departure,
        destination_port: formData.destination,
      });
    } catch (error: any) {
      setLoading(false);
      toast.error(error.message || "Failed to create passage plan");
      logger.error("Passage planning failed", {
        error: String(error),
        departure: formData.departure,
        destination: formData.destination,
      });
    }
  };

  const selectCompareCandidate = (idx: number) => {
    const candidate = comparison?.candidates[idx];
    if (candidate && candidate.status === "ok") {
      setSelectedCompareIndex(idx);
      setPassagePlan(candidate.plan);
    }
  };

  return {
    // socket / nav
    connected,
    agentStatuses,
    back,
    // tabs
    activeTab,
    setActiveTab,
    // plan result
    loading,
    passagePlan,
    comparison,
    selectedCompareIndex,
    // saved passage
    savedPassageId,
    setSavedPassageId,
    // planning options
    multiModel,
    usePolars,
    polarVesselId,
    crewCheckEnabled,
    selectedCrewIds,
    compareEnabled,
    compareCandidates,
    setMultiModel,
    setUsePolars,
    setPolarVesselId,
    setCrewCheckEnabled,
    setCompareEnabled,
    setCompareCandidates,
    toggleCrew,
    // gating + fetched lists
    tierLocked,
    polarVessels,
    crewCerts,
    // form
    formData,
    setFormData,
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    // submit + compare selection
    handleSubmit,
    selectCompareCandidate,
  };
}

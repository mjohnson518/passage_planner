"use client";

import { useEffect, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import RequireAuth from "../components/auth/RequireAuth";
import { features } from "../lib/features";
import { logger } from "../lib/logger";
import { FleetComingSoon } from "./_components/FleetComingSoon";
import { FleetEmptyState } from "./_components/FleetEmptyState";
import { FleetHeader } from "./_components/FleetHeader";
import { FleetLoading } from "./_components/FleetLoading";
import { FleetTabs } from "./_components/FleetTabs";
import { FleetDialogs } from "./_components/FleetDialogs";
import type {
  Fleet,
  FleetMember,
  FleetVessel,
} from "./_components/fleet-types";

const CreateFleetDialog = dynamic(
  () =>
    import("../components/fleet/CreateFleetDialog").then((m) => ({
      default: m.CreateFleetDialog,
    })),
  { ssr: false },
);

// Data loaded for the active fleet. Consolidated so the related
// fleet/vessels/members/loading values move together as a unit.
interface FleetData {
  fleet: Fleet | null;
  vessels: FleetVessel[];
  members: FleetMember[];
  loading: boolean;
}

type FleetDataAction =
  | { type: "setFleet"; fleet: Fleet | null }
  | { type: "setVessels"; vessels: FleetVessel[] }
  | { type: "setMembers"; members: FleetMember[] }
  | { type: "setLoading"; loading: boolean };

const initialFleetData: FleetData = {
  fleet: null,
  vessels: [],
  members: [],
  loading: true,
};

function fleetDataReducer(
  state: FleetData,
  action: FleetDataAction,
): FleetData {
  switch (action.type) {
    case "setFleet":
      return { ...state, fleet: action.fleet };
    case "setVessels":
      return { ...state, vessels: action.vessels };
    case "setMembers":
      return { ...state, members: action.members };
    case "setLoading":
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

// Visibility of the four fleet dialogs. Related, mutually-presentational
// booleans collapsed into one reducer.
type DialogName = "create" | "invite" | "addVessel" | "share";

interface DialogState {
  create: boolean;
  invite: boolean;
  addVessel: boolean;
  share: boolean;
}

type DialogAction = { type: "open" | "close"; dialog: DialogName };

const initialDialogState: DialogState = {
  create: false,
  invite: false,
  addVessel: false,
  share: false,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  return { ...state, [action.dialog]: action.type === "open" };
}

function FleetPageInner() {
  const { push } = useRouter();

  if (!features.fleet) {
    return <FleetComingSoon onGoToPlanner={() => push("/planner")} />;
  }

  return <FleetPageContent />;
}

function FleetPageContent() {
  const { user } = useAuth();
  const { push } = useRouter();
  const [data, dispatchData] = useReducer(fleetDataReducer, initialFleetData);
  const [dialogs, dispatchDialog] = useReducer(
    dialogReducer,
    initialDialogState,
  );
  const [activeTab, setActiveTab] = useState("vessels");
  const { fleet, vessels, members, loading } = data;

  useEffect(() => {
    if (!user) {
      push("/login");
      return;
    }

    // Check if user is Pro tier
    const userTier =
      (user as any)?.subscription_tier ||
      (user as any)?.user_metadata?.subscription_tier;
    if (userTier !== "pro" && userTier !== "enterprise") {
      push("/pricing?upgrade=fleet");
      return;
    }

    fetchFleet();
  }, [user, push]);

  const fetchFleet = async () => {
    try {
      const response = await fetch("/api/fleet", {
        credentials: "include",
      });

      if (response.status === 404) {
        // No fleet exists yet
        dispatchData({ type: "setLoading", loading: false });
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch fleet");
      }

      const fleetData = await response.json();
      dispatchData({ type: "setFleet", fleet: fleetData });

      // Fetch vessels and members
      await Promise.all([
        fetchVessels(fleetData.id),
        fetchMembers(fleetData.id),
      ]);
    } catch (error) {
      logger.error("Failed to fetch fleet", { error: String(error) });
      toast.error("Failed to load fleet data");
    } finally {
      dispatchData({ type: "setLoading", loading: false });
    }
  };

  const fetchVessels = async (fleetId: string) => {
    try {
      const response = await fetch(`/api/fleet/${fleetId}/vessels`, {
        credentials: "include",
      });

      if (response.ok) {
        const vesselsData = await response.json();
        dispatchData({ type: "setVessels", vessels: vesselsData });
      }
    } catch (error) {
      logger.error("Failed to fetch fleet vessels", {
        error: String(error),
        fleetId,
      });
    }
  };

  const fetchMembers = async (fleetId: string) => {
    try {
      const response = await fetch(`/api/fleet/${fleetId}/members`, {
        credentials: "include",
      });

      if (response.ok) {
        const membersData = await response.json();
        dispatchData({ type: "setMembers", members: membersData });
      }
    } catch (error) {
      logger.error("Failed to fetch fleet members", {
        error: String(error),
        fleetId,
      });
    }
  };

  const handleAddVessel = async (vesselData: any) => {
    if (!fleet) return;

    try {
      const response = await fetch(`/api/fleet/${fleet.id}/vessels`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vesselData),
      });

      if (!response.ok) {
        throw new Error("Failed to add vessel");
      }

      const newVessel = await response.json();
      dispatchData({ type: "setVessels", vessels: [...vessels, newVessel] });
      dispatchDialog({ type: "close", dialog: "addVessel" });
      toast.success("Vessel added successfully!");
    } catch (error) {
      toast.error("Failed to add vessel");
    }
  };

  const handleInviteCrew = async (
    email: string,
    role: string,
    vesselIds?: string[],
  ) => {
    if (!fleet) return;

    try {
      const response = await fetch(`/api/fleet/${fleet.id}/invite`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, role, vesselIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to send invitation");
      }

      dispatchDialog({ type: "close", dialog: "invite" });
      toast.success("Invitation sent successfully!");
    } catch (error) {
      toast.error("Failed to send invitation");
    }
  };

  if (!user || loading) {
    return <FleetLoading />;
  }

  if (!fleet) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <FleetEmptyState
            onCreateFleet={() =>
              dispatchDialog({ type: "open", dialog: "create" })
            }
          />
        </div>

        <CreateFleetDialog
          open={dialogs.create}
          onOpenChange={(open: boolean) =>
            dispatchDialog({ type: open ? "open" : "close", dialog: "create" })
          }
          onSuccess={(fleet) => {
            dispatchData({ type: "setFleet", fleet });
            dispatchDialog({ type: "close", dialog: "create" });
            toast.success("Fleet created successfully");
          }}
        />
      </div>
    );
  }

  const isAdmin = fleet.role === "admin";
  const canManage = fleet.role === "admin" || fleet.role === "captain";

  return (
    <div className="container mx-auto px-4 py-8">
      <FleetHeader
        name={fleet.name}
        description={fleet.description}
        isAdmin={isAdmin}
        onShare={() => dispatchDialog({ type: "open", dialog: "share" })}
      />

      <FleetTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        fleet={fleet}
        vessels={vessels}
        members={members}
        isAdmin={isAdmin}
        canManage={canManage}
        onAddVessel={() =>
          dispatchDialog({ type: "open", dialog: "addVessel" })
        }
        onInviteCrew={() => dispatchDialog({ type: "open", dialog: "invite" })}
        onVesselsUpdate={() => fetchVessels(fleet.id)}
        onMembersUpdate={() => fetchMembers(fleet.id)}
      />

      <FleetDialogs
        fleetId={fleet.id}
        vessels={vessels}
        members={members}
        addVesselOpen={dialogs.addVessel}
        inviteOpen={dialogs.invite}
        shareOpen={dialogs.share}
        onAddVesselOpenChange={(open) =>
          dispatchDialog({
            type: open ? "open" : "close",
            dialog: "addVessel",
          })
        }
        onInviteOpenChange={(open) =>
          dispatchDialog({ type: open ? "open" : "close", dialog: "invite" })
        }
        onShareOpenChange={(open) =>
          dispatchDialog({ type: open ? "open" : "close", dialog: "share" })
        }
        onAddVesselSubmit={handleAddVessel}
        onInviteSubmit={handleInviteCrew}
      />
    </div>
  );
}

export default function FleetPageClient() {
  return (
    <RequireAuth>
      <FleetPageInner />
    </RequireAuth>
  );
}

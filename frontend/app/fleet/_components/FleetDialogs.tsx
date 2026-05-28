"use client";

import dynamic from "next/dynamic";
import type { FleetMember, FleetVessel } from "./fleet-types";

const AddVesselDialog = dynamic(
  () =>
    import("../../components/fleet/AddVesselDialog").then((m) => ({
      default: m.AddVesselDialog,
    })),
  { ssr: false },
);
const InviteCrewDialog = dynamic(
  () =>
    import("../../components/fleet/InviteCrewDialog").then((m) => ({
      default: m.InviteCrewDialog,
    })),
  { ssr: false },
);
const SharePassageDialog = dynamic(
  () =>
    import("../../components/fleet/SharePassageDialog").then((m) => ({
      default: m.SharePassageDialog,
    })),
  { ssr: false },
);

interface FleetDialogsProps {
  fleetId: string;
  vessels: FleetVessel[];
  members: FleetMember[];
  addVesselOpen: boolean;
  inviteOpen: boolean;
  shareOpen: boolean;
  onAddVesselOpenChange: (open: boolean) => void;
  onInviteOpenChange: (open: boolean) => void;
  onShareOpenChange: (open: boolean) => void;
  onAddVesselSubmit: (vesselData: any) => Promise<void>;
  onInviteSubmit: (
    email: string,
    role: string,
    vesselIds?: string[],
  ) => Promise<void>;
}

export function FleetDialogs({
  fleetId,
  vessels,
  members,
  addVesselOpen,
  inviteOpen,
  shareOpen,
  onAddVesselOpenChange,
  onInviteOpenChange,
  onShareOpenChange,
  onAddVesselSubmit,
  onInviteSubmit,
}: FleetDialogsProps) {
  return (
    <>
      <AddVesselDialog
        open={addVesselOpen}
        onOpenChange={onAddVesselOpenChange}
        onSubmit={onAddVesselSubmit}
      />

      <InviteCrewDialog
        open={inviteOpen}
        onOpenChange={onInviteOpenChange}
        vessels={vessels}
        onSubmit={onInviteSubmit}
      />

      <SharePassageDialog
        open={shareOpen}
        onOpenChange={onShareOpenChange}
        fleetId={fleetId}
        vessels={vessels}
        members={members}
      />
    </>
  );
}

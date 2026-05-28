"use client";

import { useReducer, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import RequireAuth from "../../components/auth/RequireAuth";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../components/ui/banner";
import { toast } from "sonner";
import { logger } from "../../lib/logger";
import { DevicesFreeTierUpsell } from "./_components/DevicesFreeTierUpsell";
import {
  AddDeviceForm,
  type DeviceFormState,
} from "./_components/AddDeviceForm";
import { DeviceList } from "./_components/DeviceList";
import { CreatedDeviceDialog } from "./_components/CreatedDeviceDialog";
import { PositionsDialog } from "./_components/PositionsDialog";
import type {
  CreatedDeviceResponse,
  Device,
  PositionRow,
} from "./_components/types";

type TierState = "loading" | "free_or_premium" | "pro";

const EMPTY_FORM: DeviceFormState = {
  vendor: "generic",
  deviceId: "",
  nickname: "",
};

interface AddFormState {
  showForm: boolean;
  creating: boolean;
  form: DeviceFormState;
}

type AddFormAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "fieldChange"; patch: Partial<DeviceFormState> }
  | { type: "creating"; value: boolean }
  | { type: "reset" };

function addFormReducer(
  state: AddFormState,
  action: AddFormAction,
): AddFormState {
  switch (action.type) {
    case "open":
      return { ...state, showForm: true };
    case "close":
      return { ...state, showForm: false };
    case "fieldChange":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "creating":
      return { ...state, creating: action.value };
    case "reset":
      return { showForm: false, creating: false, form: EMPTY_FORM };
    default:
      return state;
  }
}

function DevicesContent() {
  const queryClient = useQueryClient();
  const [addForm, dispatch] = useReducer(addFormReducer, {
    showForm: false,
    creating: false,
    form: EMPTY_FORM,
  });
  const [created, setCreated] = useState<CreatedDeviceResponse | null>(null);
  const [positionsFor, setPositionsFor] = useState<Device | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile-tier-devices"],
    queryFn: async (): Promise<TierState> => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) return "free_or_premium";
        const data = (await res.json()) as { subscription_tier?: string };
        const t = data.subscription_tier ?? "free";
        return t === "pro" || t === "enterprise" ? "pro" : "free_or_premium";
      } catch {
        return "free_or_premium";
      }
    },
  });
  const tier: TierState = profileQuery.isLoading
    ? "loading"
    : (profileQuery.data ?? "free_or_premium");

  const devicesQuery = useQuery({
    queryKey: ["sat-comm-devices"],
    enabled: tier === "pro",
    queryFn: async (): Promise<Device[]> => {
      const res = await fetch("/api/sat-comm/devices", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { devices: Device[] };
      return data.devices;
    },
  });
  if (devicesQuery.error) {
    logger.error("Failed to load devices", {
      error: String(devicesQuery.error),
    });
  }
  const refresh = () => devicesQuery.refetch();
  const devices = devicesQuery.data ?? [];
  const loading = tier === "pro" && devicesQuery.isPending;

  const positionsQuery = useQuery({
    queryKey: ["sat-comm-positions", positionsFor?.id],
    enabled: positionsFor !== null,
    queryFn: async (): Promise<PositionRow[]> => {
      const res = await fetch(
        `/api/sat-comm/devices/${positionsFor!.id}/positions`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as { positions: PositionRow[] };
      return data.positions;
    },
  });
  if (positionsQuery.error) {
    logger.error("Failed to load positions", {
      error: String(positionsQuery.error),
    });
  }
  const positions = positionsQuery.error ? [] : (positionsQuery.data ?? []);
  const positionsLoading = positionsFor !== null && positionsQuery.isPending;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.form.deviceId.trim()) {
      toast.error("Device ID is required");
      return;
    }
    dispatch({ type: "creating", value: true });
    try {
      const res = await fetch("/api/sat-comm/devices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: addForm.form.vendor,
          device_id: addForm.form.deviceId.trim(),
          nickname: addForm.form.nickname.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as CreatedDeviceResponse;
      setCreated(data);
      dispatch({ type: "reset" });
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add device",
      );
      dispatch({ type: "creating", value: false });
    }
  };

  const handleDelete = async (d: Device) => {
    if (
      !window.confirm(
        `Remove ${d.nickname ?? d.device_id}? Position history will be deleted.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/sat-comm/devices/${d.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Device removed");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete device",
      );
    }
  };

  const openPositions = (d: Device) => {
    setPositionsFor(d);
  };

  const purgePositions = async (d: Device) => {
    if (
      !window.confirm(
        "Delete ALL position history for this device? This cannot be undone.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/sat-comm/devices/${d.id}/positions`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Purge failed (${res.status})`);
      const data = (await res.json()) as { purged: number };
      toast.success(`Cleared ${data.purged} position reports`);
      queryClient.setQueryData<PositionRow[]>(["sat-comm-positions", d.id], []);
    } catch (error) {
      toast.error("Failed to clear positions");
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — select the text manually");
    }
  };

  if (tier === "loading") {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </>
    );
  }

  if (tier === "free_or_premium") {
    return <DevicesFreeTierUpsell />;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-2">Sat-comm devices</h1>
              <p className="text-muted-foreground">
                Register a satellite tracker so Helmwise can ingest position
                reports and alert you if a vessel drifts off the planned route.
              </p>
            </div>
            {!addForm.showForm && (
              <Button onClick={() => dispatch({ type: "open" })}>
                <Plus className="h-4 w-4 mr-2" />
                Add device
              </Button>
            )}
          </div>

          <Banner variant="info">
            <BannerTitle>Position data is sensitive</BannerTitle>
            <BannerDescription>
              Helmwise retains the last 90 days of position reports per device.
              You can clear all data for a device at any time. Off-route alerts
              are sent to subscribers of the &quot;Safety alerts&quot; push
              topic.
            </BannerDescription>
          </Banner>

          {addForm.showForm && (
            <AddDeviceForm
              form={addForm.form}
              creating={addForm.creating}
              onFieldChange={(patch) =>
                dispatch({ type: "fieldChange", patch })
              }
              onSubmit={handleCreate}
              onCancel={() => dispatch({ type: "close" })}
            />
          )}

          <DeviceList
            loading={loading}
            devices={devices}
            onOpenPositions={openPositions}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* "Created" dialog — shows webhook URL + secret exactly once */}
      <CreatedDeviceDialog
        created={created}
        onClose={() => setCreated(null)}
        onCopy={copyToClipboard}
      />

      {/* Positions list */}
      <PositionsDialog
        positionsFor={positionsFor}
        positions={positions}
        positionsLoading={positionsLoading}
        onClose={() => setPositionsFor(null)}
        onPurge={purgePositions}
      />
    </>
  );
}

export default function DevicesPage() {
  return (
    <RequireAuth>
      <DevicesContent />
    </RequireAuth>
  );
}

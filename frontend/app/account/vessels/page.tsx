"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import RequireAuth from "../../components/auth/RequireAuth";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { logger } from "../../lib/logger";
import { FreeTierUpsell } from "./_components/FreeTierUpsell";
import { AddVesselForm } from "./_components/AddVesselForm";
import { VesselList, type Vessel } from "./_components/VesselList";

type TierState = "loading" | "free" | "premium";

function VesselsContent() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    engineHours: "",
    watermakerHours: "",
  });

  const profileQuery = useQuery({
    queryKey: ["profile-tier"],
    queryFn: async (): Promise<TierState> => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) return "free";
        const data = (await res.json()) as { subscription_tier?: string };
        const t = data.subscription_tier ?? "free";
        return t === "free" ? "free" : "premium";
      } catch {
        return "free";
      }
    },
  });
  const tier: TierState = profileQuery.isLoading
    ? "loading"
    : (profileQuery.data ?? "free");

  const vesselsQuery = useQuery({
    queryKey: ["vessels"],
    enabled: tier === "premium",
    queryFn: async (): Promise<Vessel[]> => {
      const res = await fetch("/api/vessels", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { vessels: Vessel[] };
      return data.vessels;
    },
  });
  if (vesselsQuery.error) {
    logger.error("Failed to load vessels", {
      error: String(vesselsQuery.error),
    });
  }
  const vessels = vesselsQuery.data ?? [];
  const loading = tier === "premium" && vesselsQuery.isPending;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    const payload: Record<string, unknown> = { name: form.name.trim() };
    if (form.engineHours.trim())
      payload.current_engine_hours = Number(form.engineHours);
    if (form.watermakerHours.trim())
      payload.current_watermaker_hours = Number(form.watermakerHours);
    try {
      const res = await fetch("/api/vessels", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      toast.success("Vessel added");
      setForm({ name: "", engineHours: "", watermakerHours: "" });
      setShowForm(false);
      await vesselsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add vessel",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleHoursChange = async (
    vesselId: string,
    field: "current_engine_hours" | "current_watermaker_hours",
    value: string,
  ) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return;
    try {
      const res = await fetch(`/api/vessels/${vesselId}/hours`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: num }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      // Optimistic local update so the user sees instant feedback.
      queryClient.setQueryData<Vessel[]>(["vessels"], (vs) =>
        (vs ?? []).map((v) => (v.id === vesselId ? { ...v, [field]: num } : v)),
      );
    } catch (error) {
      logger.error("Failed to update vessel hours", { error: String(error) });
      toast.error("Could not save hours");
    }
  };

  const handleDelete = async (vessel: Vessel) => {
    if (
      !window.confirm(
        `Delete ${vessel.name}? All maintenance history will be lost.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/vessels/${vessel.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Vessel removed");
      await vesselsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete vessel",
      );
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

  if (tier === "free") {
    return <FreeTierUpsell />;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-2">Vessels</h1>
              <p className="text-muted-foreground">
                Track engine hours per vessel and open the maintenance log for
                service-interval items.
              </p>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add vessel
              </Button>
            )}
          </div>

          {showForm && (
            <AddVesselForm
              form={form}
              creating={creating}
              onChange={setForm}
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          )}

          <VesselList
            loading={loading}
            vessels={vessels}
            onHoursChange={handleHoursChange}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </>
  );
}

export default function VesselsPage() {
  return (
    <RequireAuth>
      <VesselsContent />
    </RequireAuth>
  );
}

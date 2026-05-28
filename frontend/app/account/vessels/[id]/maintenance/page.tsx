"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, TriangleAlert } from "lucide-react";
import RequireAuth from "../../../../components/auth/RequireAuth";
import { Header } from "../../../../components/layout/Header";
import { Button } from "../../../../components/ui/button";
import { toast } from "sonner";
import { logger } from "../../../../lib/logger";
import {
  evaluate,
  type Category,
  type MaintenanceItem,
  type MeterSource,
  type Vessel,
} from "./_components/types";
import { AddMaintenanceItemForm } from "./_components/AddMaintenanceItemForm";
import { MaintenanceList } from "./_components/MaintenanceList";

interface MaintenanceData {
  vessel: Vessel | null;
  items: MaintenanceItem[];
}

function MaintenanceContent() {
  const params = useParams();
  const vesselId = String(params.id);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    item: "",
    category: "engine" as Category,
    intervalDays: "",
    intervalHours: "",
    meterSource: "engine" as MeterSource,
    lastServicedAt: "",
    lastServicedAtHours: "",
    notes: "",
  });

  const maintenanceQuery = useQuery({
    queryKey: ["maintenance", vesselId],
    queryFn: async (): Promise<MaintenanceData> => {
      const [vesselsRes, itemsRes] = await Promise.all([
        fetch("/api/vessels", { credentials: "include" }),
        fetch(`/api/vessels/${vesselId}/maintenance`, {
          credentials: "include",
        }),
      ]);
      let vessel: Vessel | null = null;
      let items: MaintenanceItem[] = [];
      if (vesselsRes.ok) {
        const data = (await vesselsRes.json()) as { vessels: Vessel[] };
        const found = data.vessels.find((v) => v.id === vesselId);
        vessel = found ?? null;
      }
      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as { items: MaintenanceItem[] };
        items = data.items;
      }
      return { vessel, items };
    },
  });
  if (maintenanceQuery.error) {
    logger.error("Failed to load maintenance data", {
      error: String(maintenanceQuery.error),
    });
  }
  const loading = maintenanceQuery.isPending;
  const vessel = maintenanceQuery.data?.vessel ?? null;
  const items = maintenanceQuery.data?.items ?? [];

  const refresh = () => maintenanceQuery.refetch();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (!form.intervalDays && !form.intervalHours) {
      toast.error("Set at least one interval (days or hours)");
      return;
    }
    setCreating(true);
    const payload: Record<string, unknown> = {
      item: form.item.trim(),
      category: form.category,
    };
    if (form.intervalDays.trim()) {
      payload.interval_days = Number(form.intervalDays);
    }
    if (form.intervalHours.trim()) {
      payload.interval_hours = Number(form.intervalHours);
      payload.hours_meter_source = form.meterSource;
    }
    if (form.lastServicedAt.trim()) {
      payload.last_serviced_at = new Date(form.lastServicedAt).toISOString();
    }
    if (form.lastServicedAtHours.trim()) {
      payload.last_serviced_at_hours = Number(form.lastServicedAtHours);
    }
    if (form.notes.trim()) payload.notes = form.notes.trim();

    try {
      const res = await fetch(`/api/vessels/${vesselId}/maintenance`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      toast.success("Maintenance item added");
      setShowForm(false);
      setForm({
        item: "",
        category: "engine",
        intervalDays: "",
        intervalHours: "",
        meterSource: "engine",
        lastServicedAt: "",
        lastServicedAtHours: "",
        notes: "",
      });
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add item",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleMarkServiced = async (item: MaintenanceItem) => {
    if (!vessel) return;
    const now = new Date().toISOString();
    const meterHours =
      item.hours_meter_source === "engine"
        ? vessel.current_engine_hours
        : item.hours_meter_source === "watermaker"
          ? vessel.current_watermaker_hours
          : null;
    try {
      const res = await fetch(
        `/api/vessels/${vesselId}/maintenance/${item.id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            last_serviced_at: now,
            last_serviced_at_hours: meterHours,
          }),
        },
      );
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      toast.success("Marked as serviced");
      await refresh();
    } catch (error) {
      toast.error("Failed to mark serviced");
    }
  };

  const handleDelete = async (item: MaintenanceItem) => {
    if (!window.confirm(`Delete "${item.item}"?`)) return;
    try {
      const res = await fetch(
        `/api/vessels/${vesselId}/maintenance/${item.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Item removed");
      await refresh();
    } catch (error) {
      toast.error("Failed to delete item");
    }
  };

  const now = new Date();
  const overdueCount = vessel
    ? items.filter((i) => evaluate(i, vessel, now).status === "overdue").length
    : 0;

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href="/account/vessels"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
              >
                <ArrowLeft className="h-3 w-3" />
                Vessels
              </Link>
              <h1 className="font-display text-4xl mb-2">
                {vessel?.name ?? "Vessel"} maintenance
              </h1>
              <p className="text-muted-foreground">
                {vessel
                  ? `Engine ${vessel.current_engine_hours} h · Watermaker ${vessel.current_watermaker_hours} h`
                  : "Loading vessel…"}
              </p>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add item
              </Button>
            )}
          </div>

          {overdueCount > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
              <TriangleAlert className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive/90">
                <strong>{overdueCount}</strong> item
                {overdueCount === 1 ? "" : "s"} overdue. Address them before the
                next departure.
              </p>
            </div>
          )}

          {showForm && (
            <AddMaintenanceItemForm
              form={form}
              creating={creating}
              onChange={setForm}
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          )}

          <MaintenanceList
            loading={loading}
            items={items}
            vessel={vessel}
            now={now}
            onMarkServiced={handleMarkServiced}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </>
  );
}

export default function MaintenancePage() {
  return (
    <RequireAuth>
      <MaintenanceContent />
    </RequireAuth>
  );
}

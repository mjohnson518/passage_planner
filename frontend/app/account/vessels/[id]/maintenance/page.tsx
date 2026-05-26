"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  TriangleAlert,
  Trash2,
  Wrench,
} from "lucide-react";
import RequireAuth from "../../../../components/auth/RequireAuth";
import { Header } from "../../../../components/layout/Header";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { EmptyState } from "../../../../components/ui/empty-state";
import { toast } from "sonner";
import { logger } from "../../../../lib/logger";
import { cn } from "../../../../lib/utils";

type Category =
  | "engine"
  | "watermaker"
  | "rigging"
  | "safety"
  | "sails"
  | "hull"
  | "electrical"
  | "other";

type MeterSource = "engine" | "watermaker";

interface MaintenanceItem {
  id: string;
  item: string;
  category: Category | null;
  interval_hours: number | null;
  interval_days: number | null;
  hours_meter_source: MeterSource | null;
  last_serviced_at: string | null;
  last_serviced_at_hours: number | null;
  notes: string | null;
}

interface Vessel {
  id: string;
  name: string;
  current_engine_hours: number;
  current_watermaker_hours: number;
}

type Status = "ok" | "due_soon" | "overdue";

interface Evaluation {
  status: Status;
  daysUntilDue: number | null;
  hoursUntilDue: number | null;
  reason: string;
}

const DUE_SOON_FRACTION = 0.2;

// Mirrors agents/safety/src/risk-score:scoreToStatus and MaintenanceMonitor:
// "overdue" if past either interval, "due_soon" if within 20% of either,
// else "ok". Duplicated here so the UI doesn't need a round-trip per item.
function evaluate(
  item: MaintenanceItem,
  vessel: Vessel,
  now: Date,
): Evaluation {
  if (item.last_serviced_at === null) {
    return {
      status: "overdue",
      daysUntilDue: null,
      hoursUntilDue: null,
      reason: "Never serviced — record a baseline service to start tracking.",
    };
  }
  const lastMs = new Date(item.last_serviced_at).getTime();
  if (!Number.isFinite(lastMs)) {
    return {
      status: "overdue",
      daysUntilDue: null,
      hoursUntilDue: null,
      reason: "Invalid last-serviced timestamp.",
    };
  }

  let daysUntilDue: number | null = null;
  let hoursUntilDue: number | null = null;
  const reasons: string[] = [];

  if (item.interval_days !== null) {
    const elapsedDays = (now.getTime() - lastMs) / (24 * 60 * 60 * 1000);
    daysUntilDue = item.interval_days - elapsedDays;
    if (daysUntilDue <= 0) {
      reasons.push(`${Math.round(-daysUntilDue)} days overdue`);
    }
  }
  if (item.interval_hours !== null && item.hours_meter_source !== null) {
    const baseline = item.last_serviced_at_hours ?? 0;
    const current =
      item.hours_meter_source === "engine"
        ? vessel.current_engine_hours
        : vessel.current_watermaker_hours;
    hoursUntilDue = item.interval_hours - (current - baseline);
    if (hoursUntilDue <= 0) {
      reasons.push(`${Math.round(-hoursUntilDue)} h overdue`);
    }
  }
  if (reasons.length > 0) {
    return {
      status: "overdue",
      daysUntilDue,
      hoursUntilDue,
      reason: reasons.join("; "),
    };
  }

  const daysSoon =
    daysUntilDue !== null &&
    item.interval_days !== null &&
    daysUntilDue / item.interval_days <= DUE_SOON_FRACTION;
  const hoursSoon =
    hoursUntilDue !== null &&
    item.interval_hours !== null &&
    hoursUntilDue / item.interval_hours <= DUE_SOON_FRACTION;

  if (daysSoon || hoursSoon) {
    const parts: string[] = [];
    if (daysSoon && daysUntilDue !== null)
      parts.push(`due in ${Math.round(daysUntilDue)} days`);
    if (hoursSoon && hoursUntilDue !== null)
      parts.push(`due in ${Math.round(hoursUntilDue)} h`);
    return {
      status: "due_soon",
      daysUntilDue,
      hoursUntilDue,
      reason: parts.join(", "),
    };
  }

  return {
    status: "ok",
    daysUntilDue,
    hoursUntilDue,
    reason: "Within service interval.",
  };
}

const STATUS_META: Record<Status, { label: string; classes: string }> = {
  ok: { label: "OK", classes: "text-success bg-success/10 border-success/30" },
  due_soon: {
    label: "Due soon",
    classes: "text-warning bg-warning/10 border-warning/30",
  },
  overdue: {
    label: "Overdue",
    classes: "text-destructive bg-destructive/10 border-destructive/30",
  },
};

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: "engine", label: "Engine" },
  { id: "watermaker", label: "Watermaker" },
  { id: "rigging", label: "Rigging" },
  { id: "safety", label: "Safety gear" },
  { id: "sails", label: "Sails" },
  { id: "hull", label: "Hull" },
  { id: "electrical", label: "Electrical" },
  { id: "other", label: "Other" },
];

function MaintenanceContent() {
  const params = useParams();
  const router = useRouter();
  const vesselId = String(params.id);
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [vesselsRes, itemsRes] = await Promise.all([
        fetch("/api/vessels", { credentials: "include" }),
        fetch(`/api/vessels/${vesselId}/maintenance`, {
          credentials: "include",
        }),
      ]);
      if (vesselsRes.ok) {
        const data = (await vesselsRes.json()) as { vessels: Vessel[] };
        const found = data.vessels.find((v) => v.id === vesselId);
        setVessel(found ?? null);
      }
      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as { items: MaintenanceItem[] };
        setItems(data.items);
      }
    } catch (error) {
      logger.error("Failed to load maintenance data", {
        error: String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">
                  Add maintenance item
                </h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="item">Item</Label>
                    <Input
                      id="item"
                      value={form.item}
                      onChange={(e) =>
                        setForm({ ...form, item: e.target.value })
                      }
                      placeholder="Engine oil change"
                      required
                      maxLength={200}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <select
                        id="category"
                        value={form.category}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            category: e.target.value as Category,
                          })
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="intervalDays">Interval (days)</Label>
                      <Input
                        id="intervalDays"
                        type="number"
                        min="1"
                        value={form.intervalDays}
                        onChange={(e) =>
                          setForm({ ...form, intervalDays: e.target.value })
                        }
                        placeholder="e.g. 365"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="intervalHours">Interval (hours)</Label>
                      <Input
                        id="intervalHours"
                        type="number"
                        min="1"
                        value={form.intervalHours}
                        onChange={(e) =>
                          setForm({ ...form, intervalHours: e.target.value })
                        }
                        placeholder="e.g. 100"
                      />
                    </div>
                  </div>
                  {form.intervalHours && (
                    <div className="space-y-2">
                      <Label htmlFor="meter">Hours meter source</Label>
                      <select
                        id="meter"
                        value={form.meterSource}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            meterSource: e.target.value as MeterSource,
                          })
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="engine">Engine hours</option>
                        <option value="watermaker">Watermaker hours</option>
                      </select>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lastServicedAt">
                        Last serviced (date)
                      </Label>
                      <Input
                        id="lastServicedAt"
                        type="date"
                        value={form.lastServicedAt}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            lastServicedAt: e.target.value,
                          })
                        }
                      />
                    </div>
                    {form.intervalHours && (
                      <div className="space-y-2">
                        <Label htmlFor="lastServicedAtHours">
                          Last serviced at (hours)
                        </Label>
                        <Input
                          id="lastServicedAtHours"
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.lastServicedAtHours}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              lastServicedAtHours: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Input
                      id="notes"
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                      placeholder="Use Yanmar 15W-40 oil"
                      maxLength={2000}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? "Adding…" : "Add item"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Loading maintenance items…
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<Wrench className="h-8 w-8" />}
                  title="No maintenance items yet"
                  description="Add items like oil changes, rigging inspections, or EPIRB battery checks to start tracking."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => {
                    if (!vessel) return null;
                    const ev = evaluate(item, vessel, now);
                    const meta = STATUS_META[ev.status];
                    return (
                      <li key={item.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{item.item}</p>
                              {item.category && (
                                <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                                  {item.category}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                                  meta.classes,
                                )}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {ev.reason}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Interval:{" "}
                              {[
                                item.interval_days
                                  ? `${item.interval_days} d`
                                  : null,
                                item.interval_hours
                                  ? `${item.interval_hours} h (${item.hours_meter_source})`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" or ")}
                              {item.last_serviced_at && (
                                <>
                                  {" · last serviced "}
                                  {new Date(
                                    item.last_serviced_at,
                                  ).toLocaleDateString()}
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkServiced(item)}
                              title="Mark as serviced now"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Serviced
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(item)}
                              aria-label="Delete item"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
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

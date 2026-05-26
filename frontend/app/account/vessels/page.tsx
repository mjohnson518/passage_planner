"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Ship, Sparkles, Trash2, Wrench } from "lucide-react";
import RequireAuth from "../../components/auth/RequireAuth";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EmptyState } from "../../components/ui/empty-state";
import { toast } from "sonner";
import { logger } from "../../lib/logger";

interface Vessel {
  id: string;
  name: string;
  current_engine_hours: number;
  current_watermaker_hours: number;
  created_at: string;
  updated_at: string;
}

type TierState = "loading" | "free" | "premium";

function VesselsContent() {
  const [tier, setTier] = useState<TierState>("loading");
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    engineHours: "",
    watermakerHours: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setTier("free");
          return;
        }
        const data = (await res.json()) as { subscription_tier?: string };
        if (cancelled) return;
        const t = data.subscription_tier ?? "free";
        setTier(t === "free" ? "free" : "premium");
      } catch {
        if (!cancelled) setTier("free");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vessels", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) {
          setVessels([]);
          return;
        }
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { vessels: Vessel[] };
      setVessels(data.vessels);
    } catch (error) {
      logger.error("Failed to load vessels", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tier === "premium") refresh();
  }, [tier, refresh]);

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
      await refresh();
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
      setVessels((vs) =>
        vs.map((v) => (v.id === vesselId ? { ...v, [field]: num } : v)),
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
      await refresh();
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
    return (
      <>
        <Header />
        <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Ship className="h-8 w-8" />
                </div>
                <h1 className="font-display text-3xl">Vessel maintenance</h1>
                <p className="text-muted-foreground">
                  Track engine hours, watermaker hours, rigging inspections, and
                  other service intervals per vessel. Helmwise reminds you when
                  an item is overdue — once a week, never spammy.
                </p>
                <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                  <p className="text-sm font-medium flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />A Premium
                    feature
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Maintenance tracking is part of Premium. Free users can plan
                    passages and use safety scoring without it.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Link href="/account">
                    <Button variant="outline">Back to account</Button>
                  </Link>
                  <Link href="/pricing">
                    <Button>Upgrade to Premium</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
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
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">Add a vessel</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Antares"
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="engine">Engine hours (current)</Label>
                      <Input
                        id="engine"
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.engineHours}
                        onChange={(e) =>
                          setForm({ ...form, engineHours: e.target.value })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="watermaker">
                        Watermaker hours (current)
                      </Label>
                      <Input
                        id="watermaker"
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.watermakerHours}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            watermakerHours: e.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
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
                      {creating ? "Adding…" : "Add vessel"}
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
                  Loading vessels…
                </div>
              ) : vessels.length === 0 ? (
                <EmptyState
                  icon={<Ship className="h-8 w-8" />}
                  title="No vessels yet"
                  description="Add your first vessel to start tracking maintenance items."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {vessels.map((v) => (
                    <li key={v.id} className="p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0">
                          <p className="font-medium">{v.name}</p>
                          <Link
                            href={`/account/vessels/${v.id}/maintenance`}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            <Wrench className="h-3 w-3" />
                            Open maintenance log
                          </Link>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(v)}
                          aria-label="Delete vessel"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="text-xs text-muted-foreground">
                          Engine hours
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            defaultValue={v.current_engine_hours}
                            onBlur={(e) =>
                              handleHoursChange(
                                v.id,
                                "current_engine_hours",
                                e.target.value,
                              )
                            }
                            className="mt-1"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          Watermaker hours
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            defaultValue={v.current_watermaker_hours}
                            onBlur={(e) =>
                              handleHoursChange(
                                v.id,
                                "current_watermaker_hours",
                                e.target.value,
                              )
                            }
                            className="mt-1"
                          />
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Download,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import RequireAuth from "../../../components/auth/RequireAuth";
import { Header } from "../../../components/layout/Header";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { EmptyState } from "../../../components/ui/empty-state";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../../components/ui/banner";
import { toast } from "sonner";
import { logger } from "../../../lib/logger";
import { cn } from "../../../lib/utils";

type EntryType =
  | "departure"
  | "arrival"
  | "position"
  | "watch_handover"
  | "weather"
  | "engine"
  | "fuel"
  | "event"
  | "note";

interface LogbookEntry {
  id: string;
  passage_id: string;
  vessel_id: string | null;
  entry_type: EntryType;
  occurred_at: string;
  recorded_at: string;
  recorded_by: string | null;
  position_lat: number | null;
  position_lon: number | null;
  conditions: Record<string, unknown> | null;
  notes: string | null;
}

type TierState = "loading" | "free" | "premium";

const TYPE_META: Record<EntryType, { label: string; classes: string }> = {
  departure: {
    label: "DEPARTURE",
    classes: "bg-primary/10 text-primary border-primary/30",
  },
  arrival: {
    label: "ARRIVAL",
    classes: "bg-success/10 text-success border-success/30",
  },
  position: {
    label: "POSITION",
    classes: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  },
  watch_handover: {
    label: "WATCH HANDOVER",
    classes: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  },
  weather: {
    label: "WEATHER",
    classes: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  },
  engine: {
    label: "ENGINE",
    classes: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  },
  fuel: {
    label: "FUEL/WATER",
    classes: "bg-teal-500/10 text-teal-700 border-teal-500/30",
  },
  event: {
    label: "EVENT",
    classes: "bg-destructive/10 text-destructive border-destructive/30",
  },
  note: {
    label: "NOTE",
    classes: "bg-muted text-muted-foreground border-border",
  },
};

const ALL_TYPES: EntryType[] = [
  "position",
  "watch_handover",
  "weather",
  "engine",
  "fuel",
  "event",
  "note",
  "arrival",
];

function isWithin5Min(iso: string): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < 5 * 60 * 1000;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

function formatPosition(lat: number, lon: number): string {
  const latH = lat >= 0 ? "N" : "S";
  const lonH = lon >= 0 ? "E" : "W";
  const aLat = Math.abs(lat);
  const aLon = Math.abs(lon);
  const latDeg = Math.floor(aLat);
  const lonDeg = Math.floor(aLon);
  const latMin = (aLat - latDeg) * 60;
  const lonMin = (aLon - lonDeg) * 60;
  return `${latDeg}° ${latMin.toFixed(1)}' ${latH} / ${lonDeg}° ${lonMin.toFixed(1)}' ${lonH}`;
}

function LogbookContent() {
  const params = useParams();
  const passageId = String(params.id);
  const [tier, setTier] = useState<TierState>("loading");
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    entry_type: "note" as EntryType,
    occurred_at: new Date().toISOString().slice(0, 16),
    recorded_by: "",
    position_lat: "",
    position_lon: "",
    notes: "",
    // Type-specific structured fields (only the relevant ones surface in the
    // form for each chosen entry_type).
    engine_hours: "",
    rpm: "",
    fuel_pct: "",
    water_pct: "",
    wind_kt: "",
    wind_dir: "",
    waves_m: "",
    visibility_nm: "",
    course: "",
    speed_kt: "",
    watch_from: "",
    watch_to: "",
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
      const res = await fetch(`/api/passages/${passageId}/logbook`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as { entries: LogbookEntry[] };
      setEntries(data.entries);
    } catch (error) {
      logger.error("Failed to load logbook", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }, [passageId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const buildConditions = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    const num = (s: string): number | undefined => {
      const n = Number(s);
      return s.trim() && Number.isFinite(n) ? n : undefined;
    };
    switch (form.entry_type) {
      case "engine": {
        const v = num(form.engine_hours);
        if (v !== undefined) c.engine_hours = v;
        const r = num(form.rpm);
        if (r !== undefined) c.rpm = r;
        break;
      }
      case "fuel": {
        const f = num(form.fuel_pct);
        if (f !== undefined) c.fuel_pct = f;
        const w = num(form.water_pct);
        if (w !== undefined) c.water_pct = w;
        break;
      }
      case "weather": {
        const w = num(form.wind_kt);
        if (w !== undefined) c.wind_kt = w;
        if (form.wind_dir.trim()) c.wind_dir = form.wind_dir.trim();
        const wv = num(form.waves_m);
        if (wv !== undefined) c.waves_m = wv;
        const v = num(form.visibility_nm);
        if (v !== undefined) c.visibility_nm = v;
        break;
      }
      case "position": {
        if (form.course.trim()) c.course = form.course.trim();
        const s = num(form.speed_kt);
        if (s !== undefined) c.speed_kt = s;
        break;
      }
      case "watch_handover": {
        if (form.watch_from.trim()) c.from = form.watch_from.trim();
        if (form.watch_to.trim()) c.to = form.watch_to.trim();
        if (form.course.trim()) c.course = form.course.trim();
        const s = num(form.speed_kt);
        if (s !== undefined) c.speed_kt = s;
        break;
      }
      default:
        break;
    }
    return c;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      entry_type: form.entry_type,
      occurred_at: new Date(form.occurred_at).toISOString(),
    };
    if (form.recorded_by.trim()) payload.recorded_by = form.recorded_by.trim();
    if (form.position_lat.trim() && form.position_lon.trim()) {
      const lat = Number(form.position_lat);
      const lon = Number(form.position_lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        payload.position_lat = lat;
        payload.position_lon = lon;
      }
    }
    if (form.notes.trim()) payload.notes = form.notes.trim();
    const conditions = buildConditions();
    if (Object.keys(conditions).length > 0) payload.conditions = conditions;

    try {
      const res = await fetch(`/api/passages/${passageId}/logbook`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Insert failed (${res.status})`);
      }
      toast.success("Entry added to logbook");
      setShowForm(false);
      setForm((prev) => ({
        ...prev,
        notes: "",
        engine_hours: "",
        rpm: "",
        fuel_pct: "",
        water_pct: "",
        wind_kt: "",
        wind_dir: "",
        waves_m: "",
        visibility_nm: "",
        course: "",
        speed_kt: "",
        watch_from: "",
        watch_to: "",
        position_lat: "",
        position_lon: "",
        occurred_at: new Date().toISOString().slice(0, 16),
      }));
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add entry",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: LogbookEntry) => {
    if (!isWithin5Min(entry.recorded_at)) return;
    if (!window.confirm("Delete this entry? (only allowed within 5 minutes)"))
      return;
    try {
      const res = await fetch(
        `/api/passages/${passageId}/logbook/${entry.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Delete failed (${res.status})`);
      }
      toast.success("Entry removed");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete entry",
      );
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await fetch(`/api/passages/${passageId}/logbook/pdf`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`PDF failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logbook-${passageId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Logbook PDF downloaded");
    } catch (error) {
      toast.error("Failed to download PDF");
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
              >
                <ArrowLeft className="h-3 w-3" />
                Dashboard
              </Link>
              <h1 className="font-display text-4xl mb-2">Logbook</h1>
              <p className="text-muted-foreground">
                Append-only record of this passage. Maritime tradition — once an
                entry is more than 5 minutes old, corrections are added as new
                entries.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {entries.length > 0 && (
                <Button variant="outline" onClick={handleDownloadPdf} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              )}
              {tier === "premium" && !showForm && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add entry
                </Button>
              )}
            </div>
          </div>

          {tier === "free" && (
            <Banner variant="info">
              <BannerTitle>Read-only on Free tier</BannerTitle>
              <BannerDescription>
                You can view and PDF-export an existing logbook on Free. Adding
                new entries requires Premium.{" "}
                <Link
                  href="/pricing"
                  className="text-primary hover:underline font-medium"
                >
                  Upgrade
                </Link>
              </BannerDescription>
            </Banner>
          )}

          {showForm && tier === "premium" && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">Add entry</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entry_type">Type</Label>
                      <select
                        id="entry_type"
                        value={form.entry_type}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            entry_type: e.target.value as EntryType,
                          })
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {ALL_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_META[t].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="occurred_at">When it happened</Label>
                      <Input
                        id="occurred_at"
                        type="datetime-local"
                        value={form.occurred_at}
                        onChange={(e) =>
                          setForm({ ...form, occurred_at: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="recorded_by">Recorded by</Label>
                      <Input
                        id="recorded_by"
                        value={form.recorded_by}
                        onChange={(e) =>
                          setForm({ ...form, recorded_by: e.target.value })
                        }
                        placeholder="Capt. Marc"
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position_lat">Lat (optional)</Label>
                      <Input
                        id="position_lat"
                        type="number"
                        step="0.0001"
                        min="-90"
                        max="90"
                        value={form.position_lat}
                        onChange={(e) =>
                          setForm({ ...form, position_lat: e.target.value })
                        }
                        placeholder="50.7587"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position_lon">Lon (optional)</Label>
                      <Input
                        id="position_lon"
                        type="number"
                        step="0.0001"
                        min="-180"
                        max="180"
                        value={form.position_lon}
                        onChange={(e) =>
                          setForm({ ...form, position_lon: e.target.value })
                        }
                        placeholder="-1.2982"
                      />
                    </div>
                  </div>

                  {/* Type-specific structured fields */}
                  {form.entry_type === "engine" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="engine_hours">Engine hours</Label>
                        <Input
                          id="engine_hours"
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.engine_hours}
                          onChange={(e) =>
                            setForm({ ...form, engine_hours: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rpm">RPM (optional)</Label>
                        <Input
                          id="rpm"
                          type="number"
                          min="0"
                          value={form.rpm}
                          onChange={(e) =>
                            setForm({ ...form, rpm: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                  {form.entry_type === "fuel" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fuel_pct">Fuel %</Label>
                        <Input
                          id="fuel_pct"
                          type="number"
                          min="0"
                          max="100"
                          value={form.fuel_pct}
                          onChange={(e) =>
                            setForm({ ...form, fuel_pct: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="water_pct">Water %</Label>
                        <Input
                          id="water_pct"
                          type="number"
                          min="0"
                          max="100"
                          value={form.water_pct}
                          onChange={(e) =>
                            setForm({ ...form, water_pct: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                  {form.entry_type === "weather" && (
                    <div className="grid sm:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="wind_kt">Wind (kt)</Label>
                        <Input
                          id="wind_kt"
                          type="number"
                          min="0"
                          value={form.wind_kt}
                          onChange={(e) =>
                            setForm({ ...form, wind_kt: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wind_dir">Wind dir</Label>
                        <Input
                          id="wind_dir"
                          value={form.wind_dir}
                          onChange={(e) =>
                            setForm({ ...form, wind_dir: e.target.value })
                          }
                          placeholder="WSW"
                          maxLength={10}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="waves_m">Waves (m)</Label>
                        <Input
                          id="waves_m"
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.waves_m}
                          onChange={(e) =>
                            setForm({ ...form, waves_m: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="visibility_nm">Visibility (nm)</Label>
                        <Input
                          id="visibility_nm"
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.visibility_nm}
                          onChange={(e) =>
                            setForm({ ...form, visibility_nm: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                  {(form.entry_type === "position" ||
                    form.entry_type === "watch_handover") && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="course">Course (deg)</Label>
                        <Input
                          id="course"
                          value={form.course}
                          onChange={(e) =>
                            setForm({ ...form, course: e.target.value })
                          }
                          placeholder="245"
                          maxLength={20}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="speed_kt">Speed (kt)</Label>
                        <Input
                          id="speed_kt"
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.speed_kt}
                          onChange={(e) =>
                            setForm({ ...form, speed_kt: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                  {form.entry_type === "watch_handover" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="watch_from">From watch</Label>
                        <Input
                          id="watch_from"
                          value={form.watch_from}
                          onChange={(e) =>
                            setForm({ ...form, watch_from: e.target.value })
                          }
                          placeholder="Marc"
                          maxLength={50}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="watch_to">To watch</Label>
                        <Input
                          id="watch_to"
                          value={form.watch_to}
                          onChange={(e) =>
                            setForm({ ...form, watch_to: e.target.value })
                          }
                          placeholder="Sam"
                          maxLength={50}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                      rows={3}
                      maxLength={4000}
                      placeholder="Squall passed quickly, wind clocked NW. Reefed main."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Adding…" : "Add entry"}
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
                  Loading logbook…
                </div>
              ) : entries.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-8 w-8" />}
                  title="Logbook is empty"
                  description="A departure entry is added automatically when you save a passage. Add watch handovers and observations as the passage progresses."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {entries.map((e) => {
                    const meta = TYPE_META[e.entry_type];
                    const occurred = formatDateTime(e.occurred_at);
                    const recorded = formatDateTime(e.recorded_at);
                    const sameTime =
                      Math.abs(
                        new Date(e.occurred_at).getTime() -
                          new Date(e.recorded_at).getTime(),
                      ) < 60_000;
                    const canDelete =
                      tier === "premium" && isWithin5Min(e.recorded_at);
                    return (
                      <li key={e.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                                  meta.classes,
                                )}
                              >
                                {meta.label}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {occurred}
                              </span>
                              {!sameTime && (
                                <span className="text-xs text-muted-foreground italic">
                                  (recorded {recorded})
                                </span>
                              )}
                            </div>
                            {e.position_lat !== null &&
                              e.position_lon !== null && (
                                <p className="text-sm font-mono text-muted-foreground">
                                  {formatPosition(
                                    e.position_lat,
                                    e.position_lon,
                                  )}
                                </p>
                              )}
                            {e.notes && <p className="text-sm">{e.notes}</p>}
                            {e.conditions &&
                              Object.keys(e.conditions).length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {Object.entries(e.conditions)
                                    .map(([k, v]) => `${k}: ${String(v)}`)
                                    .join(" · ")}
                                </p>
                              )}
                            {e.recorded_by && (
                              <p className="text-xs text-muted-foreground italic">
                                — {e.recorded_by}
                              </p>
                            )}
                          </div>
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(e)}
                              aria-label="Delete (within 5 min undo)"
                              title="Delete (typo undo, within 5 minutes)"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {tier === "premium" && entries.length > 0 && (
            <div className="rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
              <p>
                Logbook entries are append-only. Past the 5-minute window,
                corrections are added as new entries — this matches maritime
                tradition and preserves the log&apos;s evidentiary value.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function LogbookPage() {
  return (
    <RequireAuth>
      <LogbookContent />
    </RequireAuth>
  );
}

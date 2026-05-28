"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import RequireAuth from "../../../components/auth/RequireAuth";
import { Header } from "../../../components/layout/Header";
import { Card, CardContent } from "../../../components/ui/card";
import { toast } from "sonner";
import { logger } from "../../../lib/logger";
import { LogbookForm } from "./_components/LogbookForm";
import { LogbookEntryList } from "./_components/LogbookEntryList";
import { LogbookHeader } from "./_components/LogbookHeader";
import { AppendOnlyNote, FreeTierBanner } from "./_components/LogbookNotices";
import {
  isWithin5Min,
  type EntryType,
  type LogbookEntry,
  type LogbookFormState,
  type TierState,
} from "./_components/types";

function LogbookContent() {
  const params = useParams();
  const passageId = String(params.id);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<LogbookFormState>({
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

  const { data: tier = "loading" } = useQuery<TierState>({
    queryKey: ["profile", "logbook-tier"],
    queryFn: async () => {
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

  const {
    data: entries = [],
    isLoading: loading,
    error: loadError,
    refetch,
  } = useQuery<LogbookEntry[]>({
    queryKey: ["logbook", passageId],
    queryFn: async () => {
      const res = await fetch(`/api/passages/${passageId}/logbook`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as { entries: LogbookEntry[] };
      return data.entries;
    },
  });

  // Surface load errors the same way the old try/catch did.
  if (loadError) {
    logger.error("Failed to load logbook", { error: String(loadError) });
  }

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
      await refetch();
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
      await refetch();
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
          <LogbookHeader
            entriesCount={entries.length}
            tier={tier}
            showForm={showForm}
            onDownloadPdf={handleDownloadPdf}
            onAddEntry={() => setShowForm(true)}
          />

          {tier === "free" && <FreeTierBanner />}

          {showForm && tier === "premium" && (
            <LogbookForm
              form={form}
              setForm={setForm}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
            />
          )}

          <Card>
            <CardContent className="p-0">
              <LogbookEntryList
                loading={loading}
                entries={entries}
                tier={tier}
                onDelete={handleDelete}
              />
            </CardContent>
          </Card>

          {tier === "premium" && entries.length > 0 && <AppendOnlyNote />}
        </div>
      </div>
    </>
  );
}

export default function LogbookPageClient() {
  return (
    <RequireAuth>
      <LogbookContent />
    </RequireAuth>
  );
}

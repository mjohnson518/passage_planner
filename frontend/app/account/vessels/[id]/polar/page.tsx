"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";
import RequireAuth from "../../../../components/auth/RequireAuth";
import { Header } from "../../../../components/layout/Header";
import { Button } from "../../../../components/ui/button";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../../../components/ui/banner";
import { toast } from "sonner";
import { logger } from "../../../../lib/logger";
import { PolarFreeTierUpsell } from "./_components/PolarFreeTierUpsell";
import { UploadPolarForm } from "./_components/UploadPolarForm";
import { PolarList, type PolarRow } from "./_components/PolarList";

type TierState = "loading" | "free" | "premium";

function PolarContent() {
  const params = useParams();
  const vesselId = String(params.id);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    csv: "",
    max_wind_kt: "",
    max_wave_m: "",
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

  const polarsQuery = useQuery({
    queryKey: ["polars", vesselId],
    enabled: tier === "premium",
    queryFn: async (): Promise<PolarRow[]> => {
      const res = await fetch(`/api/vessels/${vesselId}/polars`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { polars: PolarRow[] };
      return data.polars;
    },
  });
  if (polarsQuery.error) {
    logger.error("Failed to load polars", {
      error: String(polarsQuery.error),
    });
  }
  const polars = polarsQuery.data ?? [];
  const loading = tier === "premium" && polarsQuery.isPending;

  const handleFile = (file: File) => {
    if (file.size > 2_000_000) {
      toast.error("Polar file too large (max 2 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setForm((f) => ({
        ...f,
        csv: String(e.target?.result ?? ""),
        name: f.name || file.name.replace(/\.(csv|txt|pol)$/i, ""),
      }));
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.csv.trim()) {
      toast.error("Name and CSV content are required");
      return;
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      csv: form.csv,
      source: "upload",
    };
    if (form.max_wind_kt.trim()) payload.max_wind_kt = Number(form.max_wind_kt);
    if (form.max_wave_m.trim()) payload.max_wave_m = Number(form.max_wave_m);
    try {
      const res = await fetch(`/api/vessels/${vesselId}/polars`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      toast.success("Polar uploaded");
      setForm({ name: "", csv: "", max_wind_kt: "", max_wave_m: "" });
      setShowForm(false);
      await polarsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload polar",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (polar: PolarRow) => {
    try {
      const res = await fetch(
        `/api/vessels/${vesselId}/polars/${polar.id}/activate`,
        {
          method: "PUT",
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error(`Activate failed (${res.status})`);
      toast.success(`"${polar.name}" set as active polar`);
      await polarsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to activate polar",
      );
    }
  };

  const handleDelete = async (polar: PolarRow) => {
    if (!window.confirm(`Delete polar "${polar.name}"?`)) return;
    try {
      const res = await fetch(`/api/vessels/${vesselId}/polars/${polar.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Polar removed");
      await polarsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete polar",
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
    return <PolarFreeTierUpsell vesselId={vesselId} />;
  }

  const activePolar = polars.find((p) => p.is_active);

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
              <h1 className="font-display text-4xl mb-2">Polars</h1>
              <p className="text-muted-foreground">
                Upload Expedition-format polar CSV files for this vessel. The
                active polar is what the weather router uses when
                &quot;polar-tuned route&quot; is enabled.
              </p>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload polar
              </Button>
            )}
          </div>

          <Banner variant="info">
            <BannerTitle>Coastal MVP: verify the route</BannerTitle>
            <BannerDescription>
              Polar-aware routing in v1 doesn&apos;t do automatic land
              avoidance. Always inspect the generated route on the chart; the
              router can suggest paths that cross land or shoals.
            </BannerDescription>
          </Banner>

          {showForm && (
            <UploadPolarForm
              form={form}
              submitting={submitting}
              onChange={setForm}
              onFile={handleFile}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
            />
          )}

          <PolarList
            loading={loading}
            polars={polars}
            onActivate={handleActivate}
            onDelete={handleDelete}
          />

          {activePolar && (
            <div className="rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
              <p>
                When you enable <strong>Polar-tuned route</strong> in the
                planner, the router will use the active polar (
                <strong>{activePolar.name}</strong>) for this vessel.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function PolarPage() {
  return (
    <RequireAuth>
      <PolarContent />
    </RequireAuth>
  );
}

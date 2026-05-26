"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Trash2,
  Upload,
  Wind,
} from "lucide-react";
import RequireAuth from "../../../../components/auth/RequireAuth";
import { Header } from "../../../../components/layout/Header";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { EmptyState } from "../../../../components/ui/empty-state";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../../../components/ui/banner";
import { toast } from "sonner";
import { logger } from "../../../../lib/logger";
import { cn } from "../../../../lib/utils";

interface PolarRow {
  id: string;
  name: string;
  source: "upload" | "starter" | "edited";
  polar_data: {
    tws: number[];
    twa: number[];
    speeds: number[][];
  };
  is_active: boolean;
  max_wind_kt: number | null;
  max_wave_m: number | null;
  uploaded_at: string;
  updated_at: string;
}

type TierState = "loading" | "free" | "premium";

function PolarContent() {
  const params = useParams();
  const vesselId = String(params.id);
  const [tier, setTier] = useState<TierState>("loading");
  const [polars, setPolars] = useState<PolarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    csv: "",
    max_wind_kt: "",
    max_wave_m: "",
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
      const res = await fetch(`/api/vessels/${vesselId}/polars`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setPolars([]);
          return;
        }
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { polars: PolarRow[] };
      setPolars(data.polars);
    } catch (error) {
      logger.error("Failed to load polars", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    if (tier === "premium") refresh();
  }, [tier, refresh]);

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
      await refresh();
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
      await refresh();
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
      await refresh();
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
    return (
      <>
        <Header />
        <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Wind className="h-8 w-8" />
                </div>
                <h1 className="font-display text-3xl">Custom polars</h1>
                <p className="text-muted-foreground">
                  Upload your boat&apos;s Expedition-format polar CSV. The
                  weather router will then use your vessel&apos;s actual
                  performance curves instead of a generic cruising estimate.
                </p>
                <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                  <p className="text-sm font-medium flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />A Premium
                    feature
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Polar-aware routing is part of Premium. Free users get
                    weather routing with a generic cruising polar.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Link href={`/account/vessels/${vesselId}/maintenance`}>
                    <Button variant="outline">Back to vessel</Button>
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
            <BannerTitle>Coastal MVP — verify the route</BannerTitle>
            <BannerDescription>
              Polar-aware routing in v1 doesn&apos;t do automatic land
              avoidance. Always inspect the generated route on the chart — the
              router can suggest paths that cross land or shoals.
            </BannerDescription>
          </Banner>

          {showForm && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">Upload polar</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Stock polar"
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="csv-file">CSV file</Label>
                    <input
                      id="csv-file"
                      type="file"
                      accept=".csv,.txt,.pol,text/csv,text/plain"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                      className="block w-full text-sm text-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tab/semicolon/comma separated. First column is TWA, first
                      row (after the label cell) is TWS values.
                    </p>
                  </div>
                  {form.csv && (
                    <div className="space-y-2">
                      <Label>Preview</Label>
                      <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs font-mono max-h-40 overflow-auto whitespace-pre-wrap">
                        {form.csv.split("\n").slice(0, 8).join("\n")}
                        {form.csv.split("\n").length > 8 && "\n…"}
                      </pre>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_wind">Max wind (kt, optional)</Label>
                      <Input
                        id="max_wind"
                        type="number"
                        min="0"
                        max="100"
                        value={form.max_wind_kt}
                        onChange={(e) =>
                          setForm({ ...form, max_wind_kt: e.target.value })
                        }
                        placeholder="35"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_wave">Max wave (m, optional)</Label>
                      <Input
                        id="max_wave"
                        type="number"
                        min="0"
                        max="30"
                        step="0.1"
                        value={form.max_wave_m}
                        onChange={(e) =>
                          setForm({ ...form, max_wave_m: e.target.value })
                        }
                        placeholder="3.5"
                      />
                    </div>
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
                      {submitting ? "Uploading…" : "Upload polar"}
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
                  Loading polars…
                </div>
              ) : polars.length === 0 ? (
                <EmptyState
                  icon={<Wind className="h-8 w-8" />}
                  title="No polars uploaded"
                  description="Upload an Expedition-format CSV to enable polar-tuned routing for this vessel."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {polars.map((p) => {
                    const numTws = p.polar_data?.tws?.length ?? 0;
                    const numTwa = p.polar_data?.twa?.length ?? 0;
                    return (
                      <li key={p.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{p.name}</p>
                              <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                                {p.source}
                              </span>
                              {p.is_active && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                                    "text-success bg-success/10 border-success/30",
                                  )}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {numTwa} TWA rows × {numTws} TWS columns
                              {p.max_wind_kt &&
                                ` · max wind ${p.max_wind_kt} kt`}
                              {p.max_wave_m && ` · max wave ${p.max_wave_m} m`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Uploaded{" "}
                              {new Date(p.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!p.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleActivate(p)}
                              >
                                Set active
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(p)}
                              aria-label="Delete polar"
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

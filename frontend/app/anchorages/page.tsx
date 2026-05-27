"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Anchor, Compass, MessageSquare, Plus, Search } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EmptyState } from "../components/ui/empty-state";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../components/ui/banner";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "../lib/logger";
import { cn } from "../lib/utils";

// ============================================================================
// /anchorages — community knowledge index page
//
// Public read. Three browse modes:
//   - "Near me" (browser geolocation → server PostGIS spatial query)
//   - Text search by name (server-side trigram match)
//   - Recent additions (default)
//
// "Add anchorage" form is authenticated-only with inline tier-permissive
// flow (any signed-in user can contribute).
//
// Honest disclaimer is permanent at the top — cruiser-contributed content
// requires verification before commitment.
// ============================================================================

type Holding = "good" | "fair" | "poor" | "unknown";

interface AnchorageSummary {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string | null;
  region: string | null;
  description: string | null;
  holding: Holding | null;
  shelter_from: string[] | null;
  swing_room: string | null;
  notes_count: number;
  last_note_at: string | null;
  created_at: string;
  distance_km?: number; // populated by spatial query
}

function freshnessFor(lastNoteAt: string | null): {
  label: string;
  classes: string;
} {
  if (!lastNoteAt)
    return {
      label: "No notes yet",
      classes: "text-muted-foreground bg-muted border-border",
    };
  const months =
    (Date.now() - new Date(lastNoteAt).getTime()) / (30 * 24 * 60 * 60 * 1000);
  if (months > 12)
    return {
      label: `Stale (${Math.round(months)}mo)`,
      classes: "text-destructive bg-destructive/10 border-destructive/30",
    };
  if (months > 6)
    return {
      label: `${Math.round(months)}mo old`,
      classes: "text-warning bg-warning/10 border-warning/30",
    };
  return {
    label: `Recent (${Math.round(months * 4)}wk)`,
    classes: "text-success bg-success/10 border-success/30",
  };
}

export default function AnchoragesPage() {
  const { user } = useAuth();
  const [list, setList] = useState<AnchorageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"recent" | "near" | "search">("recent");
  const [searchQ, setSearchQ] = useState("");
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    lat: "",
    lon: "",
    country: "",
    region: "",
    description: "",
  });

  const fetchList = useCallback(async (params: URLSearchParams) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anchorages?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as { anchorages: AnchorageSummary[] };
      setList(data.anchorages);
    } catch (error) {
      logger.error("Failed to load anchorages", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "recent") fetchList(new URLSearchParams());
  }, [mode, fetchList]);

  const handleNearMe = () => {
    if (!("geolocation" in navigator)) {
      setNearbyError("This browser cannot access GPS.");
      return;
    }
    setMode("near");
    setNearbyError(null);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams({
          near: `${pos.coords.latitude},${pos.coords.longitude}`,
          radius_km: "50",
        });
        fetchList(params);
      },
      (err) => {
        setNearbyError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Could not get your position.",
        );
        setLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setMode("search");
    fetchList(new URLSearchParams({ q: searchQ.trim() }));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.lat || !form.lon) {
      toast.error("Name, latitude, and longitude are required");
      return;
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      lat: Number(form.lat),
      lon: Number(form.lon),
    };
    if (form.country.trim()) payload.country = form.country.trim();
    if (form.region.trim()) payload.region = form.region.trim();
    if (form.description.trim()) payload.description = form.description.trim();
    try {
      const res = await fetch("/api/anchorages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as { anchorage: AnchorageSummary };
      toast.success(`Added "${data.anchorage.name}"`);
      setForm({
        name: "",
        lat: "",
        lon: "",
        country: "",
        region: "",
        description: "",
      });
      setShowAddForm(false);
      setMode("recent");
      fetchList(new URLSearchParams());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add anchorage",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(5),
          lon: pos.coords.longitude.toFixed(5),
        }));
        toast.success("Coordinates filled");
      },
      () => toast.error("Could not get your position"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  };

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-2">Anchorages</h1>
              <p className="text-muted-foreground">
                Cruiser-contributed knowledge: depths, holding, shelter
                directions, and notes from people who&apos;ve been there.
              </p>
            </div>
            {user && !showAddForm && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add anchorage
              </Button>
            )}
          </div>

          <Banner variant="warning">
            <BannerTitle>
              Cruiser-contributed — verify before relying
            </BannerTitle>
            <BannerDescription>
              Depths shift, holdings degrade, marinas close. Always
              cross-reference current charts and local pilots. Notes older than
              12 months are flagged stale.
            </BannerDescription>
          </Banner>

          {/* Browse mode controls */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={mode === "recent" ? "default" : "outline"}
                  onClick={() => {
                    setMode("recent");
                    fetchList(new URLSearchParams());
                  }}
                >
                  Recent
                </Button>
                <Button
                  size="sm"
                  variant={mode === "near" ? "default" : "outline"}
                  onClick={handleNearMe}
                >
                  <Compass className="h-4 w-4 mr-2" />
                  Near me
                </Button>
              </div>
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search by anchorage name…"
                  className="flex-1"
                  maxLength={200}
                />
                <Button type="submit" size="sm" variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              {nearbyError && (
                <p className="text-xs text-destructive">{nearbyError}</p>
              )}
            </CardContent>
          </Card>

          {/* Add form */}
          {showAddForm && user && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">Add an anchorage</h2>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Cala Tuent"
                      required
                      maxLength={200}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lat">Latitude *</Label>
                      <Input
                        id="lat"
                        type="number"
                        step="0.0001"
                        min="-90"
                        max="90"
                        value={form.lat}
                        onChange={(e) =>
                          setForm({ ...form, lat: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lon">Longitude *</Label>
                      <Input
                        id="lon"
                        type="number"
                        step="0.0001"
                        min="-180"
                        max="180"
                        value={form.lon}
                        onChange={(e) =>
                          setForm({ ...form, lon: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleUseCurrentLocation}
                  >
                    <Compass className="h-4 w-4 mr-2" />
                    Use my current location
                  </Button>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={form.country}
                        onChange={(e) =>
                          setForm({ ...form, country: e.target.value })
                        }
                        placeholder="Spain"
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="region">Region</Label>
                      <Input
                        id="region"
                        value={form.region}
                        onChange={(e) =>
                          setForm({ ...form, region: e.target.value })
                        }
                        placeholder="Mallorca"
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      rows={3}
                      maxLength={4000}
                      placeholder="Quiet bay on Mallorca's north coast. Sand bottom with patches of weed."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can refine holding / shelter / depth fields on the
                    detail page after creating the entry. Other cruisers
                    contribute notes; only you can edit the structured fields
                    you set here.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Adding…" : "Add anchorage"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Sign-in nudge for unauthenticated */}
          {!user && (
            <Banner variant="info">
              <BannerTitle>Sign in to contribute</BannerTitle>
              <BannerDescription>
                Anyone can browse anchorages. Adding a new anchorage or posting
                a note requires an account.{" "}
                <Link
                  href="/login"
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </Link>
              </BannerDescription>
            </Banner>
          )}

          {/* List */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Loading anchorages…
                </div>
              ) : list.length === 0 ? (
                <EmptyState
                  icon={<Anchor className="h-8 w-8" />}
                  title="No anchorages here yet"
                  description={
                    mode === "near"
                      ? "Nothing contributed within 50 km of your position. Be the first — sailors after you will thank you."
                      : mode === "search"
                        ? "No matches. Try a shorter search term or browse Recent / Near me."
                        : "The database is empty. Be the first to add an anchorage."
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((a) => {
                    const freshness = freshnessFor(a.last_note_at);
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/anchorages/${a.id}`}
                          className="block p-5 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{a.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {[a.region, a.country]
                                  .filter(Boolean)
                                  .join(", ") ||
                                  `${a.lat.toFixed(3)}, ${a.lon.toFixed(3)}`}
                                {a.distance_km !== undefined && (
                                  <span className="ml-2 font-mono">
                                    · {a.distance_km.toFixed(1)} km away
                                  </span>
                                )}
                              </p>
                              {a.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {a.description}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                                  freshness.classes,
                                )}
                              >
                                {freshness.label}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <MessageSquare className="h-3 w-3" />
                                {a.notes_count} note
                                {a.notes_count === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                        </Link>
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

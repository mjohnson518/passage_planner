"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Compass, Plus, Search } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../components/ui/banner";
import { useAuth } from "../contexts/AuthContext";
import { logger } from "../lib/logger";
import {
  AnchorageList,
  type AnchorageSummary,
} from "./_components/AnchorageList";
import { AddAnchorageForm } from "./_components/AddAnchorageForm";

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

export default function AnchoragesPageClient() {
  const { user } = useAuth();
  // `mode` (UI highlighting / empty-state copy) and `queryString` (the active
  // list query) always move together, so they share one state object — set in
  // one update, never chained.
  const [browse, setBrowse] = useState<{
    mode: "recent" | "near" | "search";
    queryString: string;
  }>({ mode: "recent", queryString: "" });
  const { mode, queryString } = browse;
  const [searchQ, setSearchQ] = useState("");
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["anchorages", queryString],
    queryFn: async (): Promise<AnchorageSummary[]> => {
      try {
        const res = await fetch(`/api/anchorages?${queryString}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const body = (await res.json()) as { anchorages: AnchorageSummary[] };
        return body.anchorages;
      } catch (error) {
        logger.error("Failed to load anchorages", { error: String(error) });
        throw error;
      }
    },
    placeholderData: keepPreviousData,
  });

  const list = data ?? [];

  const handleRecent = () => {
    if (queryString === "") {
      setBrowse({ mode: "recent", queryString: "" });
      void refetch();
    } else {
      setBrowse({ mode: "recent", queryString: "" });
    }
  };

  const handleNearMe = () => {
    if (!("geolocation" in navigator)) {
      setNearbyError("This browser cannot access GPS.");
      return;
    }
    setBrowse((b) => ({ ...b, mode: "near" }));
    setNearbyError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams({
          near: `${pos.coords.latitude},${pos.coords.longitude}`,
          radius_km: "50",
        });
        setBrowse({ mode: "near", queryString: params.toString() });
      },
      (err) => {
        setNearbyError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Could not get your position.",
        );
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setBrowse({
      mode: "search",
      queryString: new URLSearchParams({ q: searchQ.trim() }).toString(),
    });
  };

  const handleCreated = () => {
    setShowAddForm(false);
    if (queryString === "") {
      setBrowse({ mode: "recent", queryString: "" });
      void refetch();
    } else {
      setBrowse({ mode: "recent", queryString: "" });
    }
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
              Cruiser-contributed: verify before relying
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
                  onClick={handleRecent}
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
            <AddAnchorageForm
              onCancel={() => setShowAddForm(false)}
              onCreated={handleCreated}
            />
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
          <AnchorageList loading={isFetching} list={list} mode={mode} />
        </div>
      </div>
    </>
  );
}

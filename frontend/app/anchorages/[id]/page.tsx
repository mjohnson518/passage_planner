"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Anchor,
  ArrowLeft,
  MessageSquare,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../components/ui/banner";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "../../lib/logger";
import { cn } from "../../lib/utils";

type Holding = "good" | "fair" | "poor" | "unknown";
type Conditions = "calm" | "breezy" | "gusty" | "rough" | "stormy";

interface Anchorage {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string | null;
  region: string | null;
  description: string | null;
  approx_depth_m: number | null;
  holding: Holding | null;
  shelter_from: string[] | null;
  swing_room: string | null;
  notes_count: number;
  last_note_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface AnchorageNote {
  id: string;
  author_id: string;
  author_name: string | null;
  visited_on: string | null;
  body: string;
  rating_overall: number | null;
  rating_holding: number | null;
  rating_shelter: number | null;
  conditions: Conditions | null;
  created_at: string;
  updated_at: string;
}

function stalenessFor(iso: string): { color: string; label: string } {
  const months =
    (Date.now() - new Date(iso).getTime()) / (30 * 24 * 60 * 60 * 1000);
  if (months > 12)
    return { color: "text-destructive", label: `${Math.round(months)}mo old` };
  if (months > 6)
    return { color: "text-warning", label: `${Math.round(months)}mo old` };
  return {
    color: "text-muted-foreground",
    label: `${Math.round(months * 4)}wk old`,
  };
}

function Stars({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i <= value
              ? "fill-warning text-warning"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

function AnchorageDetailContent() {
  const params = useParams();
  const id = String(params.id);
  const { user } = useAuth();
  const [anchorage, setAnchorage] = useState<Anchorage | null>(null);
  const [notes, setNotes] = useState<AnchorageNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noteForm, setNoteForm] = useState({
    visited_on: "",
    body: "",
    rating_overall: 0,
    rating_holding: 0,
    rating_shelter: 0,
    conditions: "" as "" | Conditions,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, nRes] = await Promise.all([
        fetch(`/api/anchorages/${id}`, { credentials: "include" }),
        fetch(`/api/anchorages/${id}/notes`, { credentials: "include" }),
      ]);
      if (aRes.ok) {
        const data = (await aRes.json()) as { anchorage: Anchorage };
        setAnchorage(data.anchorage);
      }
      if (nRes.ok) {
        const data = (await nRes.json()) as { notes: AnchorageNote[] };
        setNotes(data.notes);
      }
    } catch (error) {
      logger.error("Failed to load anchorage detail", {
        error: String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (noteForm.body.trim().length < 10) {
      toast.error("Note body needs at least 10 characters");
      return;
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = { body: noteForm.body.trim() };
    if (noteForm.visited_on) payload.visited_on = noteForm.visited_on;
    if (noteForm.rating_overall > 0)
      payload.rating_overall = noteForm.rating_overall;
    if (noteForm.rating_holding > 0)
      payload.rating_holding = noteForm.rating_holding;
    if (noteForm.rating_shelter > 0)
      payload.rating_shelter = noteForm.rating_shelter;
    if (noteForm.conditions) payload.conditions = noteForm.conditions;
    try {
      const res = await fetch(`/api/anchorages/${id}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Post failed (${res.status})`);
      }
      toast.success("Note posted");
      setShowNoteForm(false);
      setNoteForm({
        visited_on: "",
        body: "",
        rating_overall: 0,
        rating_holding: 0,
        rating_shelter: 0,
        conditions: "",
      });
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to post note",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (note: AnchorageNote) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      const res = await fetch(`/api/anchorages/${id}/notes/${note.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Note removed");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete note",
      );
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading anchorage…</p>
        </div>
      </>
    );
  }

  if (!anchorage) {
    return (
      <>
        <Header />
        <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-md text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Anchor className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl">Anchorage not found</h1>
            <Link href="/anchorages">
              <Button variant="outline">Back to anchorages</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  const isCreator = user?.id === anchorage.created_by;

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Link
            href="/anchorages"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            All anchorages
          </Link>

          {/* Aggregate hero */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h1 className="font-display text-4xl mb-1">{anchorage.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {[anchorage.region, anchorage.country]
                    .filter(Boolean)
                    .join(", ") || "Unknown region"}
                  <span className="ml-2 font-mono">
                    {anchorage.lat.toFixed(4)}, {anchorage.lon.toFixed(4)}
                  </span>
                </p>
              </div>
              {anchorage.description && (
                <p className="text-sm">{anchorage.description}</p>
              )}
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {anchorage.approx_depth_m !== null && (
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Approx depth
                    </dt>
                    <dd>{anchorage.approx_depth_m} m</dd>
                  </div>
                )}
                {anchorage.holding && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Holding</dt>
                    <dd className="capitalize">{anchorage.holding}</dd>
                  </div>
                )}
                {anchorage.shelter_from &&
                  anchorage.shelter_from.length > 0 && (
                    <div>
                      <dt className="text-muted-foreground text-xs">
                        Shelter from
                      </dt>
                      <dd>{anchorage.shelter_from.join(", ")}</dd>
                    </div>
                  )}
                {anchorage.swing_room && (
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Swing room
                    </dt>
                    <dd className="capitalize">{anchorage.swing_room}</dd>
                  </div>
                )}
              </dl>
              {isCreator && (
                <p className="text-xs text-muted-foreground border-t border-border pt-3">
                  You added this anchorage — you can edit the structured fields
                  above. (Editing UI coming soon; for now, contact support to
                  update.)
                </p>
              )}
            </CardContent>
          </Card>

          <Banner variant="warning">
            <BannerTitle>Verify before relying</BannerTitle>
            <BannerDescription>
              Cruiser-contributed knowledge. Depths shift, holdings degrade,
              regulations change. Cross-reference current charts and local
              pilots before committing.
            </BannerDescription>
          </Banner>

          {/* Notes section */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl">
              {notes.length} note{notes.length === 1 ? "" : "s"}
            </h2>
            {user ? (
              !showNoteForm && (
                <Button onClick={() => setShowNoteForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add note
                </Button>
              )
            ) : (
              <Link href="/login">
                <Button size="sm" variant="outline">
                  Sign in to add note
                </Button>
              </Link>
            )}
          </div>

          {showNoteForm && user && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-lg mb-3">
                  Share what you found here
                </h3>
                <form onSubmit={handleAddNote} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="body">Notes *</Label>
                    <textarea
                      id="body"
                      value={noteForm.body}
                      onChange={(e) =>
                        setNoteForm({ ...noteForm, body: e.target.value })
                      }
                      rows={4}
                      minLength={10}
                      maxLength={4000}
                      required
                      placeholder="Anchored in 4m sand. Holding good but a bit weedy near the western shore. Took a south-west swell overnight; would be uncomfortable in anything stronger than 15kt SW. Restaurant ashore was friendly to cruisers."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="visited_on">Visited on</Label>
                      <Input
                        id="visited_on"
                        type="date"
                        value={noteForm.visited_on}
                        onChange={(e) =>
                          setNoteForm({
                            ...noteForm,
                            visited_on: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="conditions">Conditions</Label>
                      <select
                        id="conditions"
                        value={noteForm.conditions}
                        onChange={(e) =>
                          setNoteForm({
                            ...noteForm,
                            conditions: e.target.value as "" | Conditions,
                          })
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">—</option>
                        <option value="calm">Calm</option>
                        <option value="breezy">Breezy</option>
                        <option value="gusty">Gusty</option>
                        <option value="rough">Rough</option>
                        <option value="stormy">Stormy</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {(
                      [
                        ["rating_overall", "Overall"],
                        ["rating_holding", "Holding"],
                        ["rating_shelter", "Shelter"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() =>
                                setNoteForm({ ...noteForm, [key]: i })
                              }
                              aria-label={`${label} ${i} of 5`}
                              className="p-0.5"
                            >
                              <Star
                                className={cn(
                                  "h-5 w-5",
                                  i <= noteForm[key]
                                    ? "fill-warning text-warning"
                                    : "text-muted-foreground/40",
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowNoteForm(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Posting…" : "Post note"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {notes.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No notes yet. Be the first to share what you found here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => {
                const staleness = stalenessFor(n.created_at);
                const isMine = user?.id === n.author_id;
                return (
                  <li key={n.id}>
                    <Card>
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm">
                              {n.author_name ?? "Anonymous cruiser"}
                            </p>
                            <p className={cn("text-xs", staleness.color)}>
                              {n.visited_on ? `Visited ${n.visited_on} · ` : ""}
                              posted {staleness.label}
                              {n.conditions && (
                                <span className="ml-2 capitalize">
                                  · {n.conditions}
                                </span>
                              )}
                            </p>
                          </div>
                          {isMine && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteNote(n)}
                              aria-label="Delete my note"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>

                        {(n.rating_overall !== null ||
                          n.rating_holding !== null ||
                          n.rating_shelter !== null) && (
                          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                            {n.rating_overall !== null && (
                              <div>
                                <p>Overall</p>
                                <Stars value={n.rating_overall} />
                              </div>
                            )}
                            {n.rating_holding !== null && (
                              <div>
                                <p>Holding</p>
                                <Stars value={n.rating_holding} />
                              </div>
                            )}
                            {n.rating_shelter !== null && (
                              <div>
                                <p>Shelter</p>
                                <Stars value={n.rating_shelter} />
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export default function AnchorageDetailPage() {
  return <AnchorageDetailContent />;
}

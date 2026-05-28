"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Anchor, ArrowLeft, Plus } from "lucide-react";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../components/ui/banner";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "../../lib/logger";
import { AnchorageHero } from "./_components/AnchorageHero";
import { NoteForm, type NotePayload } from "./_components/NoteForm";
import { NoteList } from "./_components/NoteList";

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

function AnchorageDetailContent() {
  const params = useParams();
  const id = String(params.id);
  const { user } = useAuth();
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    data,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["anchorage-detail", id],
    queryFn: async (): Promise<{
      anchorage: Anchorage | null;
      notes: AnchorageNote[];
    }> => {
      try {
        const [aRes, nRes] = await Promise.all([
          fetch(`/api/anchorages/${id}`, { credentials: "include" }),
          fetch(`/api/anchorages/${id}/notes`, { credentials: "include" }),
        ]);
        let anchorage: Anchorage | null = null;
        let notes: AnchorageNote[] = [];
        if (aRes.ok) {
          const body = (await aRes.json()) as { anchorage: Anchorage };
          anchorage = body.anchorage;
        }
        if (nRes.ok) {
          const body = (await nRes.json()) as { notes: AnchorageNote[] };
          notes = body.notes;
        }
        return { anchorage, notes };
      } catch (error) {
        logger.error("Failed to load anchorage detail", {
          error: String(error),
        });
        return { anchorage: null, notes: [] };
      }
    },
  });

  const anchorage = data?.anchorage ?? null;
  const notes = data?.notes ?? [];

  const handleAddNote = async (payload: NotePayload) => {
    setSubmitting(true);
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
      await refetch();
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
      await refetch();
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
          <AnchorageHero anchorage={anchorage} isCreator={isCreator} />

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
            <NoteForm
              submitting={submitting}
              onCancel={() => setShowNoteForm(false)}
              onSubmit={handleAddNote}
            />
          )}

          <NoteList
            notes={notes}
            currentUserId={user?.id}
            onDelete={handleDeleteNote}
          />
        </div>
      </div>
    </>
  );
}

export default function AnchorageDetailPageClient() {
  return <AnchorageDetailContent />;
}

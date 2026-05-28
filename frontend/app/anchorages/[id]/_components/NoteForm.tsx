"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { cn } from "../../../lib/utils";

type Conditions = "calm" | "breezy" | "gusty" | "rough" | "stormy";

export interface NotePayload {
  body: string;
  visited_on?: string;
  rating_overall?: number;
  rating_holding?: number;
  rating_shelter?: number;
  conditions?: Conditions;
}

export function NoteForm({
  submitting,
  onCancel,
  onSubmit,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: NotePayload) => void;
}) {
  const [noteForm, setNoteForm] = useState({
    visited_on: "",
    body: "",
    rating_overall: 0,
    rating_holding: 0,
    rating_shelter: 0,
    conditions: "" as "" | Conditions,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noteForm.body.trim().length < 10) {
      toast.error("Note body needs at least 10 characters");
      return;
    }
    const payload: NotePayload = { body: noteForm.body.trim() };
    if (noteForm.visited_on) payload.visited_on = noteForm.visited_on;
    if (noteForm.rating_overall > 0)
      payload.rating_overall = noteForm.rating_overall;
    if (noteForm.rating_holding > 0)
      payload.rating_holding = noteForm.rating_holding;
    if (noteForm.rating_shelter > 0)
      payload.rating_shelter = noteForm.rating_shelter;
    if (noteForm.conditions) payload.conditions = noteForm.conditions;
    onSubmit(payload);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-display text-lg mb-3">Share what you found here</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="body">Notes *</Label>
            <textarea
              id="body"
              aria-label="Notes"
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
                <option value="">-</option>
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
                      onClick={() => setNoteForm({ ...noteForm, [key]: i })}
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
              onClick={onCancel}
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
  );
}

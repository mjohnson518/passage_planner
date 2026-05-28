import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { cn } from "../../../lib/utils";
import { Stars } from "./Stars";

type Conditions = "calm" | "breezy" | "gusty" | "rough" | "stormy";

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

export function NoteList({
  notes,
  currentUserId,
  onDelete,
}: {
  notes: AnchorageNote[];
  currentUserId: string | undefined;
  onDelete: (note: AnchorageNote) => void;
}) {
  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No notes yet. Be the first to share what you found here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {notes.map((n) => {
        const staleness = stalenessFor(n.created_at);
        const isMine = currentUserId === n.author_id;
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
                      onClick={() => onDelete(n)}
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
  );
}

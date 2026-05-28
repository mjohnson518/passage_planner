import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  relationship: string | null;
  notify_on_overdue: boolean;
}

interface ContactListProps {
  loading: boolean;
  contacts: Contact[];
  showForm: boolean;
  onNew: () => void;
  onEdit: (c: Contact) => void;
  onDelete: (id: string) => void;
}

export function ContactList({
  loading,
  contacts,
  showForm,
  onNew,
  onEdit,
  onDelete,
}: ContactListProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading contacts…
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No emergency contacts yet"
            description="Add at least one person who should be notified about your passages. You can add up to 5."
            action={
              !showForm && (
                <Button onClick={onNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first contact
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{c.name}</p>
                    {c.relationship && (
                      <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        {c.relationship}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {c.email}
                    {c.phone && <span className="ml-3">{c.phone}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(c)}
                    aria-label={`Edit ${c.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import RequireAuth from "../../components/auth/RequireAuth";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EmptyState } from "../../components/ui/empty-state";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../components/ui/banner";
import { toast } from "sonner";
import { logger } from "../../lib/logger";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  relationship: string | null;
  notify_on_overdue: boolean;
}

const MAX_CONTACTS = 5;
const RELATIONSHIPS = [
  "Spouse",
  "Family",
  "Co-skipper",
  "Friend",
  "Harbour authority",
  "Other",
];

interface FormState {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  relationship: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  email: "",
  phone: "",
  relationship: "",
};

function ContactsContent() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/float-plan-contacts", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data: { contacts: Contact[] } = await res.json();
      setContacts(data.contacts);
    } catch (error) {
      logger.error("Failed to load contacts", { error: String(error) });
      toast.error("Could not load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const atLimit = contacts.length >= MAX_CONTACTS;
  const editing = form.id !== null;

  const handleNew = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleEdit = (c: Contact) => {
    setForm({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone ?? "",
      relationship: c.relationship ?? "",
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
    };
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.relationship.trim())
      payload.relationship = form.relationship.trim();

    try {
      const url = editing
        ? `/api/float-plan-contacts/${form.id}`
        : "/api/float-plan-contacts";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      toast.success(editing ? "Contact updated" : "Contact added");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save contact",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this emergency contact?")) return;
    try {
      const res = await fetch(`/api/float-plan-contacts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Contact removed");
      await refresh();
    } catch (error) {
      logger.error("Failed to delete contact", { error: String(error) });
      toast.error("Could not remove contact");
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-2">Emergency contacts</h1>
              <p className="text-muted-foreground">
                These are the people who receive your float plan before each
                passage. If your vessel is overdue, they are the ones who will
                escalate to authorities.
              </p>
            </div>
            {!showForm && (
              <Button onClick={handleNew} disabled={atLimit}>
                <Plus className="h-4 w-4 mr-2" />
                Add contact
              </Button>
            )}
          </div>

          <Banner variant="warning">
            <BannerTitle>Helmwise does NOT alert authorities</BannerTitle>
            <BannerDescription>
              A float plan is an email and a PDF — nothing more. The recipients
              listed here are who Helmwise relies on to call the Coast Guard or
              the appropriate harbour authority if you do not check in.
            </BannerDescription>
          </Banner>

          {showForm && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">
                  {editing ? "Edit contact" : "Add emergency contact"}
                </h2>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="Jane Doe"
                        required
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        placeholder="jane@example.com"
                        required
                        maxLength={254}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone (optional)</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                        placeholder="+1 555 555 1212"
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="relationship">Relationship</Label>
                      <select
                        id="relationship"
                        value={form.relationship}
                        onChange={(e) =>
                          setForm({ ...form, relationship: e.target.value })
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Choose…</option>
                        {RELATIONSHIPS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving
                        ? "Saving…"
                        : editing
                          ? "Save changes"
                          : "Add contact"}
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
                  Loading contacts…
                </div>
              ) : contacts.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-8 w-8" />}
                  title="No emergency contacts yet"
                  description="Add at least one person who should be notified about your passages. You can add up to 5."
                  action={
                    !showForm && (
                      <Button onClick={handleNew}>
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
                          onClick={() => handleEdit(c)}
                          aria-label={`Edit ${c.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c.id)}
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

          <p className="text-xs text-muted-foreground text-center">
            Up to {MAX_CONTACTS} contacts per account · {contacts.length} of{" "}
            {MAX_CONTACTS} used
          </p>
        </div>
      </div>
    </>
  );
}

export default function AccountContactsPage() {
  return (
    <RequireAuth>
      <ContactsContent />
    </RequireAuth>
  );
}

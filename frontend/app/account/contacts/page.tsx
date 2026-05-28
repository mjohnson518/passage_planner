"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import RequireAuth from "../../components/auth/RequireAuth";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../components/ui/banner";
import { toast } from "sonner";
import { logger } from "../../lib/logger";
import { ContactForm, type FormState } from "./_components/ContactForm";
import { ContactList, type Contact } from "./_components/ContactList";

const MAX_CONTACTS = 5;

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  email: "",
  phone: "",
  relationship: "",
};

function ContactsContent() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const contactsQuery = useQuery({
    queryKey: ["float-plan-contacts"],
    queryFn: async (): Promise<Contact[]> => {
      try {
        const res = await fetch("/api/float-plan-contacts", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data: { contacts: Contact[] } = await res.json();
        return data.contacts;
      } catch (error) {
        logger.error("Failed to load contacts", { error: String(error) });
        toast.error("Could not load contacts");
        throw error;
      }
    },
  });
  const refresh = () => contactsQuery.refetch();
  const contacts = contactsQuery.data ?? [];
  const loading = contactsQuery.isPending;

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
              A float plan is an email and a PDF, nothing more. The recipients
              listed here are who Helmwise relies on to call the Coast Guard or
              the appropriate harbour authority if you do not check in.
            </BannerDescription>
          </Banner>

          {showForm && (
            <ContactForm
              form={form}
              editing={editing}
              saving={saving}
              onChange={setForm}
              onSubmit={handleSave}
              onCancel={handleCancel}
            />
          )}

          <ContactList
            loading={loading}
            contacts={contacts}
            showForm={showForm}
            onNew={handleNew}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

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

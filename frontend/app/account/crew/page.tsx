"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";
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
import { CrewFreeTierUpsell } from "./_components/CrewFreeTierUpsell";
import { CertForm } from "./_components/CertForm";
import { CertList } from "./_components/CertList";
import {
  CERT_TYPE_LABELS,
  EMPTY_FORM,
  type Certification,
  type FormState,
} from "./_components/types";

type TierState = "loading" | "free_or_premium" | "pro";

function CrewContent() {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const profileQuery = useQuery({
    queryKey: ["profile-tier-crew"],
    queryFn: async (): Promise<TierState> => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) return "free_or_premium";
        const data = (await res.json()) as { subscription_tier?: string };
        const t = data.subscription_tier ?? "free";
        return t === "pro" || t === "enterprise" ? "pro" : "free_or_premium";
      } catch {
        return "free_or_premium";
      }
    },
  });
  const tier: TierState = profileQuery.isLoading
    ? "loading"
    : (profileQuery.data ?? "free_or_premium");

  const certsQuery = useQuery({
    queryKey: ["crew-certifications"],
    queryFn: async (): Promise<Certification[]> => {
      const res = await fetch("/api/account/crew-certifications", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { certifications: Certification[] };
      return data.certifications;
    },
  });
  if (certsQuery.error) {
    logger.error("Failed to load crew certifications", {
      error: String(certsQuery.error),
    });
  }
  const refresh = () => certsQuery.refetch();
  const certs = certsQuery.data ?? [];
  const loading = certsQuery.isPending;

  const handleEdit = (cert: Certification) => {
    setForm({
      id: cert.id,
      crew_name: cert.crew_name ?? "",
      cert_type: cert.cert_type,
      cert_label: cert.cert_label ?? "",
      issued_date: cert.issued_date ?? "",
      expiry_date: cert.expiry_date,
      issuing_authority: cert.issuing_authority ?? "",
      document_url: cert.document_url ?? "",
      notes: cert.notes ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.crew_name.trim() || !form.expiry_date) {
      toast.error("Crew name and expiry date are required");
      return;
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      crew_name: form.crew_name.trim(),
      cert_type: form.cert_type,
      expiry_date: form.expiry_date,
    };
    if (form.cert_label.trim()) payload.cert_label = form.cert_label.trim();
    if (form.issued_date) payload.issued_date = form.issued_date;
    if (form.issuing_authority.trim())
      payload.issuing_authority = form.issuing_authority.trim();
    if (form.document_url.trim())
      payload.document_url = form.document_url.trim();
    if (form.notes.trim()) payload.notes = form.notes.trim();
    try {
      const url = form.id
        ? `/api/account/crew-certifications/${form.id}`
        : "/api/account/crew-certifications";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      toast.success(form.id ? "Certification updated" : "Certification added");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save certification",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cert: Certification) => {
    const name = cert.crew_name ?? "this crew member";
    if (
      !window.confirm(
        `Delete the "${CERT_TYPE_LABELS[cert.cert_type]}" cert for ${name}?`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/account/crew-certifications/${cert.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Certification removed");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete certification",
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

  if (tier === "free_or_premium") {
    return <CrewFreeTierUpsell />;
  }

  const now = new Date();
  const expiredCount = certs.filter(
    (c) => new Date(c.expiry_date).getTime() < now.getTime(),
  ).length;

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-2">
                Crew certifications
              </h1>
              <p className="text-muted-foreground">
                Track STCW, USCG license, medicals, first aid, passports, and
                other crew certifications. The planner warns you before
                departure if any are expired.
              </p>
            </div>
            {!showForm && (
              <Button
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setShowForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add cert
              </Button>
            )}
          </div>

          <Banner variant="info">
            <BannerTitle>Documents are linked, not hosted</BannerTitle>
            <BannerDescription>
              Paste a link to your own cloud storage (Drive, Dropbox, iCloud) in
              the document URL field. Helmwise does not host the PDFs
              themselves.
            </BannerDescription>
          </Banner>

          {expiredCount > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive/90">
                <strong>{expiredCount}</strong> expired certification
                {expiredCount === 1 ? "" : "s"}. Renew before crew sail on
                commercial trips.
              </p>
            </div>
          )}

          {showForm && (
            <CertForm
              form={form}
              submitting={submitting}
              onChange={setForm}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
            />
          )}

          <CertList
            loading={loading}
            certs={certs}
            now={now}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </>
  );
}

export default function CrewPage() {
  return (
    <RequireAuth>
      <CrewContent />
    </RequireAuth>
  );
}

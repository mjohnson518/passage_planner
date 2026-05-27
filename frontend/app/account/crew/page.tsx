"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
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
import { cn } from "../../lib/utils";

type CertType =
  | "stcw_bst"
  | "stcw_advanced"
  | "uscg_oupv"
  | "uscg_master"
  | "medical_eng1"
  | "medical_cg719k"
  | "first_aid"
  | "gmdss_rro"
  | "gmdss_goc"
  | "passport"
  | "visa"
  | "yachtmaster"
  | "icc"
  | "powerboat_l2"
  | "other";

const CERT_TYPE_LABELS: Record<CertType, string> = {
  stcw_bst: "STCW Basic Safety Training",
  stcw_advanced: "STCW Advanced",
  uscg_oupv: "USCG OUPV (6-pack)",
  uscg_master: "USCG Master",
  medical_eng1: "ENG1 (UK MCA medical)",
  medical_cg719k: "CG-719K (USCG medical)",
  first_aid: "First aid",
  gmdss_rro: "GMDSS Restricted Operator (VHF DSC)",
  gmdss_goc: "GMDSS General Operator (HF)",
  passport: "Passport",
  visa: "Visa",
  yachtmaster: "RYA Yachtmaster",
  icc: "ICC (International Certificate of Competence)",
  powerboat_l2: "RYA Powerboat Level 2",
  other: "Other",
};

interface Certification {
  id: string;
  crew_user_id: string | null;
  crew_name: string | null;
  cert_type: CertType;
  cert_label: string | null;
  issued_date: string | null;
  expiry_date: string;
  issuing_authority: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type TierState = "loading" | "free_or_premium" | "pro";

interface CertStatus {
  label: string;
  classes: string;
  Icon: typeof CheckCircle2;
}

function statusFor(expiryIso: string, now: Date = new Date()): CertStatus {
  const expiry = new Date(expiryIso);
  if (!Number.isFinite(expiry.getTime())) {
    return {
      label: "Invalid date",
      classes: "text-destructive bg-destructive/10 border-destructive/30",
      Icon: AlertTriangle,
    };
  }
  const days = Math.floor(
    (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days < 0)
    return {
      label: `Expired ${-days}d ago`,
      classes: "text-destructive bg-destructive/10 border-destructive/30",
      Icon: AlertTriangle,
    };
  if (days <= 30)
    return {
      label: `Expires in ${days}d`,
      classes: "text-warning bg-warning/10 border-warning/30",
      Icon: Clock,
    };
  if (days <= 90)
    return {
      label: `Expires in ${days}d`,
      classes: "text-warning bg-warning/10 border-warning/30",
      Icon: Clock,
    };
  return {
    label: `Valid until ${expiry.toISOString().slice(0, 10)}`,
    classes: "text-success bg-success/10 border-success/30",
    Icon: CheckCircle2,
  };
}

interface FormState {
  id: string | null;
  crew_name: string;
  cert_type: CertType;
  cert_label: string;
  issued_date: string;
  expiry_date: string;
  issuing_authority: string;
  document_url: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  crew_name: "",
  cert_type: "stcw_bst",
  cert_label: "",
  issued_date: "",
  expiry_date: "",
  issuing_authority: "",
  document_url: "",
  notes: "",
};

function CrewContent() {
  const [tier, setTier] = useState<TierState>("loading");
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setTier("free_or_premium");
          return;
        }
        const data = (await res.json()) as { subscription_tier?: string };
        if (cancelled) return;
        const t = data.subscription_tier ?? "free";
        setTier(t === "pro" || t === "enterprise" ? "pro" : "free_or_premium");
      } catch {
        if (!cancelled) setTier("free_or_premium");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/crew-certifications", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) {
          setCerts([]);
          return;
        }
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { certifications: Certification[] };
      setCerts(data.certifications);
    } catch (error) {
      logger.error("Failed to load crew certifications", {
        error: String(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    return (
      <>
        <Header />
        <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-8 w-8" />
                </div>
                <h1 className="font-display text-3xl">Crew certifications</h1>
                <p className="text-muted-foreground">
                  Track STCW, USCG license, medical (ENG1 / CG-719K), first aid,
                  passport, visa, and other crew certifications. The planner
                  warns you before departure if a crew member&apos;s cert is
                  expired or expires soon.
                </p>
                <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                  <p className="text-sm font-medium flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />A Pro feature
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Built for charter captains, delivery skippers, and fleet
                    operators who need to stay on top of compliance.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Link href="/account">
                    <Button variant="outline">Back to account</Button>
                  </Link>
                  <Link href="/pricing">
                    <Button>Upgrade to Pro</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
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
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">
                  {form.id ? "Edit certification" : "Add certification"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="crew_name">Crew member</Label>
                      <Input
                        id="crew_name"
                        value={form.crew_name}
                        onChange={(e) =>
                          setForm({ ...form, crew_name: e.target.value })
                        }
                        placeholder="Capt. Marc Johnson"
                        required
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cert_type">Cert type</Label>
                      <select
                        id="cert_type"
                        value={form.cert_type}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            cert_type: e.target.value as CertType,
                          })
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {(Object.keys(CERT_TYPE_LABELS) as CertType[]).map(
                          (t) => (
                            <option key={t} value={t}>
                              {CERT_TYPE_LABELS[t]}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>
                  {(form.cert_type === "uscg_master" ||
                    form.cert_type === "other") && (
                    <div className="space-y-2">
                      <Label htmlFor="cert_label">Specific cert name</Label>
                      <Input
                        id="cert_label"
                        value={form.cert_label}
                        onChange={(e) =>
                          setForm({ ...form, cert_label: e.target.value })
                        }
                        placeholder="USCG 100GT Master Inland/Near Coastal"
                        maxLength={200}
                      />
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="issued_date">Issued</Label>
                      <Input
                        id="issued_date"
                        type="date"
                        value={form.issued_date}
                        onChange={(e) =>
                          setForm({ ...form, issued_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiry_date">Expires *</Label>
                      <Input
                        id="expiry_date"
                        type="date"
                        value={form.expiry_date}
                        onChange={(e) =>
                          setForm({ ...form, expiry_date: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issuing_authority">Issuing authority</Label>
                    <Input
                      id="issuing_authority"
                      value={form.issuing_authority}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          issuing_authority: e.target.value,
                        })
                      }
                      placeholder="USCG, MCA, RYA, …"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document_url">
                      Document URL (link only)
                    </Label>
                    <Input
                      id="document_url"
                      type="url"
                      value={form.document_url}
                      onChange={(e) =>
                        setForm({ ...form, document_url: e.target.value })
                      }
                      placeholder="https://drive.google.com/…"
                      maxLength={2000}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                      rows={2}
                      maxLength={2000}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setForm(EMPTY_FORM);
                      }}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting
                        ? "Saving…"
                        : form.id
                          ? "Save changes"
                          : "Add cert"}
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
                  Loading certifications…
                </div>
              ) : certs.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-8 w-8" />}
                  title="No certifications tracked"
                  description="Add your first cert to start tracking expiry. The planner will warn you before departure if any crew cert is expired."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {certs.map((c) => {
                    const status = statusFor(c.expiry_date, now);
                    return (
                      <li key={c.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">
                                {c.crew_name ?? "Crew member"}
                              </p>
                              <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                                {CERT_TYPE_LABELS[c.cert_type]}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                                  status.classes,
                                )}
                              >
                                <status.Icon className="h-3 w-3" />
                                {status.label}
                              </span>
                            </div>
                            {c.cert_label && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {c.cert_label}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {c.issuing_authority &&
                                `${c.issuing_authority} · `}
                              {c.issued_date && `Issued ${c.issued_date} · `}
                              Expires {c.expiry_date}
                            </p>
                            {c.document_url && (
                              <a
                                href={c.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Document
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(c)}
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(c)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
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

export default function CrewPage() {
  return (
    <RequireAuth>
      <CrewContent />
    </RequireAuth>
  );
}

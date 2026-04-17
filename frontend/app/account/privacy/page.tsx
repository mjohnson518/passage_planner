"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "../../components/auth/RequireAuth";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { logger } from "../../lib/logger";

type DeleteStage = "idle" | "confirm" | "deleting";

function AccountPrivacyContent() {
  const { user, session, signOut } = useAuth();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [deleteStage, setDeleteStage] = useState<DeleteStage>("idle");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const accountEmail = (user?.email ?? "").toLowerCase();
  const confirmMatches =
    confirmEmail.trim().toLowerCase() === accountEmail &&
    accountEmail.length > 0;

  const handleExport = async () => {
    if (!session?.access_token) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/data-export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `helmwise-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error("data export failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(
        "Export failed. Please try again or contact privacy@helmwise.co.",
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.access_token) return;
    if (!confirmMatches) {
      setError("Email does not match your account email.");
      return;
    }
    setDeleteStage("deleting");
    setError(null);
    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `Delete failed (${res.status})`,
        );
      }
      await signOut();
      router.replace("/?deleted=1");
    } catch (err) {
      logger.error("account deletion failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError("Account deletion failed. Please contact privacy@helmwise.co.");
      setDeleteStage("confirm");
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="font-display text-4xl mb-2">Your Data</h1>
            <p className="text-muted-foreground">
              Download your personal data or permanently delete your Helmwise
              account. Signed in as{" "}
              <span className="font-mono">{user?.email}</span>.
            </p>
          </div>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-display text-xl mb-2">Export your data</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Download a JSON bundle containing your account record, vessel
              profiles, passages, checklists, usage history, and safety audit
              records.
            </p>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Preparing export…" : "Download my data"}
            </Button>
          </section>

          <section className="rounded-lg border border-destructive/40 bg-card p-6">
            <h2 className="font-display text-xl mb-2 text-destructive">
              Delete your account
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              This permanently deletes your account, vessel profiles, passages,
              and personal data. Anonymized safety audit logs may be retained
              for regulatory compliance, as described in our{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </a>
              . This action cannot be undone.
            </p>

            {deleteStage === "idle" ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteStage("confirm");
                  setError(null);
                }}
              >
                Delete my account
              </Button>
            ) : (
              <div className="space-y-3">
                <label
                  htmlFor="confirmEmail"
                  className="block text-sm font-medium"
                >
                  Type <span className="font-mono">{user?.email}</span> to
                  confirm:
                </label>
                <input
                  id="confirmEmail"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  disabled={deleteStage === "deleting"}
                  autoComplete="off"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-destructive focus:outline-none focus:ring-1 focus:ring-destructive"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteStage === "deleting" || !confirmMatches}
                  >
                    {deleteStage === "deleting"
                      ? "Deleting…"
                      : "Permanently delete account"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteStage("idle");
                      setConfirmEmail("");
                      setError(null);
                    }}
                    disabled={deleteStage === "deleting"}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/60 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Questions about your data? Email{" "}
            <a
              href="mailto:privacy@helmwise.co"
              className="text-primary hover:underline"
            >
              privacy@helmwise.co
            </a>
            .
          </p>
        </div>
      </div>
    </>
  );
}

export default function AccountPrivacyPage() {
  return (
    <RequireAuth>
      <AccountPrivacyContent />
    </RequireAuth>
  );
}

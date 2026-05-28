"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
import { ApiKeysFreeTierUpsell } from "./_components/ApiKeysFreeTierUpsell";
import { CreateKeyForm } from "./_components/CreateKeyForm";
import { ApiKeyList } from "./_components/ApiKeyList";
import { CreatedKeyDialog } from "./_components/CreatedKeyDialog";
import type { ApiKeyRow, Scope } from "./_components/types";

type TierState = "loading" | "free_or_premium" | "pro";

function ApiKeysContent() {
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    scopes: { read: true, write: false },
    rate_limit_per_day: "1000",
  });
  const [createdKey, setCreatedKey] = useState<{
    rawKey: string;
    row: ApiKeyRow;
  } | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile-tier-api-keys"],
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

  const keysQuery = useQuery({
    queryKey: ["api-keys"],
    enabled: tier === "pro",
    queryFn: async (): Promise<ApiKeyRow[]> => {
      const res = await fetch("/api/account/api-keys", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { keys: ApiKeyRow[] };
      return data.keys;
    },
  });
  if (keysQuery.error) {
    logger.error("Failed to load API keys", {
      error: String(keysQuery.error),
    });
  }
  const refresh = () => keysQuery.refetch();
  const keys = keysQuery.data ?? [];
  const loading = tier === "pro" && keysQuery.isPending;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const scopes: Scope[] = [];
    if (form.scopes.read) scopes.push("read");
    if (form.scopes.write) scopes.push("write");
    if (scopes.length === 0) {
      toast.error("Pick at least one scope");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          scopes,
          rate_limit_per_day: Number(form.rate_limit_per_day) || 1000,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as {
        rawKey: string;
        key: ApiKeyRow;
      };
      setCreatedKey({ rawKey: data.rawKey, row: data.key });
      setForm({
        name: "",
        scopes: { read: true, write: false },
        rate_limit_per_day: "1000",
      });
      setShowForm(false);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create key",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKeyRow) => {
    if (
      !window.confirm(
        `Revoke "${key.name}"? Any apps using this key will stop working immediately.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/account/api-keys/${key.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Revoke failed (${res.status})`);
      toast.success("Key revoked");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke key",
      );
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — select the text manually");
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
    return <ApiKeysFreeTierUpsell />;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-2">API keys</h1>
              <p className="text-muted-foreground">
                Generate keys to call Helmwise from your own scripts and
                integrations. Keys are shown ONCE at creation:{" "}
                <strong>save them immediately</strong>.{" "}
                <Link href="/api-docs" className="text-primary hover:underline">
                  View API docs →
                </Link>
              </p>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create key
              </Button>
            )}
          </div>

          <Banner variant="info">
            <BannerTitle>Treat API keys like passwords</BannerTitle>
            <BannerDescription>
              A leaked key gives anyone full access at your account&apos;s
              scopes. Never commit keys to git, never paste them in support
              tickets, and revoke immediately on suspected exposure.
            </BannerDescription>
          </Banner>

          {showForm && (
            <CreateKeyForm
              form={form}
              creating={creating}
              onChange={setForm}
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          )}

          <ApiKeyList loading={loading} keys={keys} onRevoke={handleRevoke} />

          <p className="text-xs text-muted-foreground text-center">
            Up to 10 active keys per account ·{" "}
            {keys.filter((k) => !k.revoked_at).length} of 10 used
          </p>
        </div>
      </div>

      {/* One-time secret display modal — shown immediately after creation. */}
      <CreatedKeyDialog
        createdKey={createdKey}
        onClose={() => setCreatedKey(null)}
        onCopy={copyToClipboard}
      />
    </>
  );
}

export default function ApiKeysPage() {
  return (
    <RequireAuth>
      <ApiKeysContent />
    </RequireAuth>
  );
}

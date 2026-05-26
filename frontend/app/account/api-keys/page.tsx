"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Key, Plus, Sparkles, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { logger } from "../../lib/logger";
import { cn } from "../../lib/utils";

type Scope = "read" | "write";

interface ApiKeyRow {
  id: string;
  key_prefix: string;
  name: string;
  scopes: Scope[];
  rate_limit_per_day: number;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

type TierState = "loading" | "free_or_premium" | "pro";

function ApiKeysContent() {
  const [tier, setTier] = useState<TierState>("loading");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
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
      const res = await fetch("/api/account/api-keys", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) {
          setKeys([]);
          return;
        }
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { keys: ApiKeyRow[] };
      setKeys(data.keys);
    } catch (error) {
      logger.error("Failed to load API keys", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tier === "pro") refresh();
  }, [tier, refresh]);

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
    return (
      <>
        <Header />
        <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Key className="h-8 w-8" />
                </div>
                <h1 className="font-display text-3xl">API keys</h1>
                <p className="text-muted-foreground">
                  Generate API keys to call Helmwise endpoints from your own
                  scripts, integrations, or chartplotter apps. Per-key rate
                  limits, scoped access, and instant revocation.
                </p>
                <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                  <p className="text-sm font-medium flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />A Pro feature
                  </p>
                  <p className="text-sm text-muted-foreground">
                    API access is part of Pro, designed for charter operators
                    and developers integrating Helmwise into their own tools.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Link href="/api-docs">
                    <Button variant="outline">View API docs</Button>
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
                integrations. Keys are shown ONCE at creation —{" "}
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
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">Create API key</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Chartplotter integration"
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scopes</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.scopes.read}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              scopes: {
                                ...form.scopes,
                                read: e.target.checked,
                              },
                            })
                          }
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span>
                          <strong>read</strong> — list passages, fetch
                          weather/tides
                        </span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.scopes.write}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              scopes: {
                                ...form.scopes,
                                write: e.target.checked,
                              },
                            })
                          }
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span>
                          <strong>write</strong> — create/save passages, run
                          planning
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate">Rate limit (requests / day)</Label>
                    <Input
                      id="rate"
                      type="number"
                      min="1"
                      max="1000000"
                      value={form.rate_limit_per_day}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          rate_limit_per_day: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? "Creating…" : "Create key"}
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
                  Loading keys…
                </div>
              ) : keys.length === 0 ? (
                <EmptyState
                  icon={<Key className="h-8 w-8" />}
                  title="No API keys yet"
                  description="Create your first key to start calling Helmwise from your own scripts or integrations."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {keys.map((k) => {
                    const revoked = k.revoked_at !== null;
                    return (
                      <li
                        key={k.id}
                        className={cn("p-5", revoked && "opacity-60")}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{k.name}</p>
                              {revoked ? (
                                <span className="text-xs rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-medium">
                                  Revoked
                                </span>
                              ) : (
                                <span className="text-xs rounded-full bg-success/10 text-success px-2 py-0.5 font-medium">
                                  Active
                                </span>
                              )}
                              {k.scopes.map((s) => (
                                <span
                                  key={s}
                                  className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground font-mono mt-1">
                              {k.key_prefix}…
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {k.rate_limit_per_day.toLocaleString()} req/day ·
                              created{" "}
                              {new Date(k.created_at).toLocaleDateString()}
                              {k.last_used_at && (
                                <>
                                  {" "}
                                  · last used{" "}
                                  {new Date(
                                    k.last_used_at,
                                  ).toLocaleDateString()}
                                </>
                              )}
                              {revoked && (
                                <>
                                  {" "}
                                  · revoked{" "}
                                  {new Date(k.revoked_at!).toLocaleDateString()}
                                </>
                              )}
                            </p>
                          </div>
                          {!revoked && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRevoke(k)}
                              aria-label="Revoke key"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Up to 10 active keys per account ·{" "}
            {keys.filter((k) => !k.revoked_at).length} of 10 used
          </p>
        </div>
      </div>

      {/* One-time secret display modal — shown immediately after creation. */}
      <Dialog
        open={createdKey !== null}
        onOpenChange={(open) => !open && setCreatedKey(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Save your API key now</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Lost keys cannot be
              recovered — you&apos;ll need to revoke and create a new one.
            </DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  API key (for the X-API-Key header)
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={createdKey.rawKey}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(createdKey.rawKey, "API key")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                <p className="font-medium text-warning mb-1">
                  Treat this like a password.
                </p>
                <p className="text-xs text-muted-foreground">
                  Send with{" "}
                  <code className="font-mono bg-muted px-1 py-0.5 rounded">
                    X-API-Key: {createdKey.rawKey.slice(0, 12)}…
                  </code>{" "}
                  on every request. Scopes:{" "}
                  <code className="font-mono">
                    {createdKey.row.scopes.join(", ")}
                  </code>
                  . Rate limit:{" "}
                  {createdKey.row.rate_limit_per_day.toLocaleString()} req/day.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>
              I&apos;ve saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Link as LinkIcon,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { logger } from "../../lib/logger";

interface ShareMetadata {
  token: string;
  expiresAt: string;
  createdAt: string;
  viewCount: number;
  lastViewedAt: string | null;
}

interface SharePlanButtonProps {
  passageId: string | null;
}

type TierState = "loading" | "free" | "premium";

export function SharePlanButton({ passageId }: SharePlanButtonProps) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<TierState>("loading");
  const [share, setShare] = useState<ShareMetadata | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  // Load tier once — cached for the session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) {
          // 401 → user not signed in. The Save button already enforces auth
          // before passageId is set, so this branch is rare.
          if (!cancelled) setTier("free");
          return;
        }
        const data = (await res.json()) as { subscription_tier?: string };
        if (cancelled) return;
        const t = data.subscription_tier ?? "free";
        setTier(t === "free" ? "free" : "premium");
      } catch {
        if (!cancelled) setTier("free");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStatus = useCallback(async () => {
    if (!passageId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/passages/${passageId}/share`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setShare(null);
          setShareUrl(null);
          return;
        }
        throw new Error(`Status load failed (${res.status})`);
      }
      const data = (await res.json()) as {
        share: ShareMetadata | null;
        url?: string;
      };
      setShare(data.share);
      setShareUrl(data.url ?? null);
    } catch (error) {
      logger.error("Failed to load share status", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }, [passageId]);

  useEffect(() => {
    if (open && passageId && tier === "premium") loadStatus();
  }, [open, passageId, tier, loadStatus]);

  const handleCreate = async () => {
    if (!passageId) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/passages/${passageId}/share`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          upgradeRequired?: boolean;
        };
        if (body.upgradeRequired) setTier("free");
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as {
        share: ShareMetadata;
        url: string;
      };
      setShare(data.share);
      setShareUrl(data.url);
      toast.success(share ? "New share link generated" : "Share link created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create link",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    if (!passageId) return;
    if (!window.confirm("Revoke this share link? The URL will stop working.")) {
      return;
    }
    setWorking(true);
    try {
      const res = await fetch(`/api/passages/${passageId}/share`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Revoke failed (${res.status})`);
      setShare(null);
      setShareUrl(null);
      toast.success("Share link revoked");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke link",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed — select the URL manually");
    }
  };

  const disabled = !passageId;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          disabled
            ? "Save the passage first, then create a share link"
            : "Share this passage with family or crew"
        }
      >
        <LinkIcon className="h-4 w-4 mr-2" />
        Share link
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share passage</DialogTitle>
            <DialogDescription>
              {tier === "premium"
                ? "Anyone with the link can view a read-only summary. Vessel identifiers, contacts, and personal data are stripped automatically."
                : "Generate a read-only link that family or co-skippers can open without an account."}
            </DialogDescription>
          </DialogHeader>

          {tier === "loading" ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              Loading…
            </p>
          ) : tier === "free" ? (
            <div className="py-4 space-y-4">
              <div className="rounded-md border border-border bg-muted/40 p-4 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">A Premium feature</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Premium subscribers can share read-only passage links with
                    family, crew, and contacts. Includes auto-expiry and one-tap
                    revocation.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Link href="/pricing">
                  <Button>Upgrade to Premium</Button>
                </Link>
              </DialogFooter>
            </div>
          ) : loading ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              Loading share status…
            </p>
          ) : share && shareUrl ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <div className="flex items-stretch gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    aria-label="Copy link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(share.expiresAt).toLocaleDateString()} ·{" "}
                  Viewed {share.viewCount}{" "}
                  {share.viewCount === 1 ? "time" : "times"}
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={handleRevoke}
                  disabled={working}
                >
                  <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                  Revoke
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCreate}
                  disabled={working}
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                No share link active for this passage. Generate one with a 7-day
                default expiry; you can revoke or regenerate at any time.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={working}>
                  {working ? "Generating…" : "Generate share link"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

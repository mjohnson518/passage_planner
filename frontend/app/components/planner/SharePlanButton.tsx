"use client";

import { useReducer } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

interface ShareStatus {
  share: ShareMetadata | null;
  shareUrl: string | null;
}

interface DialogState {
  open: boolean;
  working: boolean;
  /** Local override of the fetched share status, applied after create/revoke
   *  mutations so we don't have to refetch. Null means "use the fetched data". */
  override: ShareStatus | null;
}

type DialogAction =
  | { type: "openChanged"; open: boolean }
  | { type: "workingChanged"; working: boolean }
  | { type: "statusOverridden"; status: ShareStatus };

const initialDialogState: DialogState = {
  open: false,
  working: false,
  override: null,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "openChanged":
      return { ...state, open: action.open };
    case "workingChanged":
      return { ...state, working: action.working };
    case "statusOverridden":
      return { ...state, override: action.status };
    default:
      return state;
  }
}

export function SharePlanButton({ passageId }: SharePlanButtonProps) {
  const [state, dispatch] = useReducer(dialogReducer, initialDialogState);
  const { open, working, override } = state;
  const queryClient = useQueryClient();

  // Load tier once — cached for the session.
  const { data: tier = "loading" } = useQuery<TierState>({
    queryKey: ["profile", "share-tier"],
    queryFn: async () => {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (!res.ok) {
        // 401 → user not signed in. The Save button already enforces auth
        // before passageId is set, so this branch is rare.
        return "free";
      }
      const data = (await res.json()) as { subscription_tier?: string };
      const t = data.subscription_tier ?? "free";
      return t === "free" ? "free" : "premium";
    },
  });

  const {
    data: fetchedStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery<ShareStatus>({
    queryKey: ["passage-share", passageId],
    enabled: open && !!passageId && tier === "premium",
    queryFn: async () => {
      const res = await fetch(`/api/passages/${passageId}/share`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          return { share: null, shareUrl: null };
        }
        throw new Error(`Status load failed (${res.status})`);
      }
      const data = (await res.json()) as {
        share: ShareMetadata | null;
        url?: string;
      };
      return { share: data.share, shareUrl: data.url ?? null };
    },
  });

  // Surface query errors the same way the old try/catch did.
  if (statusError) {
    logger.error("Failed to load share status", {
      error: String(statusError),
    });
  }

  const status: ShareStatus = override ??
    fetchedStatus ?? { share: null, shareUrl: null };
  const { share, shareUrl } = status;
  // While the status query is in-flight (and no local override applied), show
  // the loading state — only relevant when premium + open.
  const loading = statusLoading && override === null;

  const handleOpenChange = (next: boolean) => {
    dispatch({ type: "openChanged", open: next });
  };

  const setStatus = (next: ShareStatus) => {
    dispatch({ type: "statusOverridden", status: next });
    queryClient.setQueryData(["passage-share", passageId], next);
  };

  const handleCreate = async () => {
    if (!passageId) return;
    dispatch({ type: "workingChanged", working: true });
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
        if (body.upgradeRequired) {
          queryClient.setQueryData(["profile", "share-tier"], "free");
        }
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as {
        share: ShareMetadata;
        url: string;
      };
      setStatus({ share: data.share, shareUrl: data.url });
      toast.success(share ? "New share link generated" : "Share link created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create link",
      );
    } finally {
      dispatch({ type: "workingChanged", working: false });
    }
  };

  const handleRevoke = async () => {
    if (!passageId) return;
    if (!window.confirm("Revoke this share link? The URL will stop working.")) {
      return;
    }
    dispatch({ type: "workingChanged", working: true });
    try {
      const res = await fetch(`/api/passages/${passageId}/share`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Revoke failed (${res.status})`);
      setStatus({ share: null, shareUrl: null });
      toast.success("Share link revoked");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke link",
      );
    } finally {
      dispatch({ type: "workingChanged", working: false });
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
        onClick={() => handleOpenChange(true)}
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

      <Dialog open={open} onOpenChange={handleOpenChange}>
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
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
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
                <Button onClick={() => handleOpenChange(false)}>Close</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                No share link active for this passage. Generate one with a 7-day
                default expiry; you can revoke or regenerate at any time.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
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

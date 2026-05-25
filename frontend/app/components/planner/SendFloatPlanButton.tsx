"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LifeBuoy, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";
import { toast } from "sonner";
import { logger } from "../../lib/logger";

interface Contact {
  id: string;
  name: string;
  email: string;
  relationship: string | null;
}

interface DeliveryStatus {
  [contactId: string]: { ok: boolean; resendId?: string; error?: string };
}

interface SendFloatPlanButtonProps {
  /** The Redis-side passage id returned by POST /api/passages. Null while
   *  no passage has been saved this session. */
  passageId: string | null;
  /** Optional label fragments — only used in the dialog copy to help the user
   *  confirm they're sending the right plan. */
  departureLabel?: string;
  destinationLabel?: string;
}

export function SendFloatPlanButton({
  passageId,
  departureLabel,
  destinationLabel,
}: SendFloatPlanButtonProps) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    delivery: DeliveryStatus;
    sentAt: string | null;
  } | null>(null);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch("/api/float-plan-contacts", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data: { contacts: Contact[] } = await res.json();
      setContacts(data.contacts);
      setSelected(new Set(data.contacts.map((c) => c.id)));
    } catch (error) {
      logger.error("Failed to load contacts", { error: String(error) });
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (open && contacts === null) loadContacts();
  }, [open, contacts, loadContacts]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Reset on close so re-opening shows fresh state, not the last result.
      setResult(null);
    }
  };

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (checked) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const handleSend = async () => {
    if (!passageId || selected.size === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/passages/${passageId}/float-plan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientIds: Array.from(selected) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        deliveryStatus?: DeliveryStatus;
        sentAt?: string | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Send failed (${res.status})`);
      }
      setResult({
        delivery: data.deliveryStatus ?? {},
        sentAt: data.sentAt ?? null,
      });
      const okCount = Object.values(data.deliveryStatus ?? {}).filter(
        (s) => s.ok,
      ).length;
      const failedCount = Object.values(data.deliveryStatus ?? {}).filter(
        (s) => !s.ok,
      ).length;
      if (failedCount === 0) {
        toast.success(
          `Float plan sent to ${okCount} contact${okCount === 1 ? "" : "s"}`,
        );
      } else if (okCount === 0) {
        toast.error("Float plan failed to send to any recipients");
      } else {
        toast.warning(
          `Float plan sent to ${okCount}, failed for ${failedCount}`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send float plan",
      );
    } finally {
      setSending(false);
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
            ? "Save the passage first, then send a float plan"
            : "Send float plan to your emergency contacts"
        }
      >
        <LifeBuoy className="h-4 w-4 mr-2" />
        Send Float Plan
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send float plan</DialogTitle>
            <DialogDescription>
              {departureLabel && destinationLabel
                ? `Choose who should receive the plan for ${departureLabel} → ${destinationLabel}.`
                : "Choose who should receive this float plan."}
            </DialogDescription>
          </DialogHeader>

          {loadingContacts ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              Loading contacts…
            </p>
          ) : contacts === null ? null : contacts.length === 0 ? (
            <div className="py-6 space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                You have no emergency contacts on file.
              </p>
              <Link href="/account/contacts">
                <Button variant="outline">Add contacts</Button>
              </Link>
            </div>
          ) : result ? (
            <ul className="space-y-2 py-2">
              {contacts.map((c) => {
                const r = result.delivery[c.id];
                if (!r) return null;
                return (
                  <li
                    key={c.id}
                    className="flex items-start gap-2 rounded-md border border-border p-3"
                  >
                    {r.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.ok
                          ? `Delivered to ${c.email}`
                          : `Failed: ${r.error ?? "unknown error"}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-2 py-2 max-h-72 overflow-y-auto">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-1.5">
                  <Checkbox
                    id={`contact-${c.id}`}
                    checked={selected.has(c.id)}
                    onCheckedChange={(checked) =>
                      toggle(c.id, checked === true)
                    }
                    className="mt-1"
                  />
                  <label
                    htmlFor={`contact-${c.id}`}
                    className="flex-1 cursor-pointer min-w-0"
                  >
                    <p className="text-sm font-medium">
                      {c.name}
                      {c.relationship && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {c.relationship}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.email}
                    </p>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {contacts && contacts.length > 0 && !result && (
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              The PDF includes vessel, route, ETA, and instructions for the
              recipient to follow if you are overdue. Helmwise will NOT alert
              authorities automatically — your contact is.
            </p>
          )}

          <DialogFooter>
            {result ? (
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={sending}
                >
                  Cancel
                </Button>
                {contacts && contacts.length > 0 && (
                  <Button
                    onClick={handleSend}
                    disabled={sending || selected.size === 0}
                  >
                    {sending
                      ? "Sending…"
                      : `Send to ${selected.size} contact${selected.size === 1 ? "" : "s"}`}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

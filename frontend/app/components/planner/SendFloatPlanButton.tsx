"use client";

import { useReducer } from "react";
import { useQuery } from "@tanstack/react-query";
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

interface SendResult {
  delivery: DeliveryStatus;
  sentAt: string | null;
}

interface DialogState {
  open: boolean;
  /** Contact ids the user has checked. */
  selected: Set<string>;
  sending: boolean;
  result: SendResult | null;
}

type DialogAction =
  | { type: "opened" }
  | { type: "closed" }
  | { type: "selectionInitialized"; ids: string[] }
  | { type: "toggled"; id: string; checked: boolean }
  | { type: "sendStarted" }
  | { type: "sendSettled"; result: SendResult | null };

const initialDialogState: DialogState = {
  open: false,
  selected: new Set(),
  sending: false,
  result: null,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "opened":
      return { ...state, open: true };
    case "closed":
      // Reset on close so re-opening shows fresh state, not the last result.
      return { ...state, open: false, result: null };
    case "selectionInitialized":
      return { ...state, selected: new Set(action.ids) };
    case "toggled": {
      const copy = new Set(state.selected);
      if (action.checked) copy.add(action.id);
      else copy.delete(action.id);
      return { ...state, selected: copy };
    }
    case "sendStarted":
      return { ...state, sending: true, result: null };
    case "sendSettled":
      return {
        ...state,
        sending: false,
        result: action.result ?? state.result,
      };
    default:
      return state;
  }
}

export function SendFloatPlanButton({
  passageId,
  departureLabel,
  destinationLabel,
}: SendFloatPlanButtonProps) {
  const [state, dispatch] = useReducer(dialogReducer, initialDialogState);
  const { open, selected, sending, result } = state;

  const { data: contacts = null, isLoading: loadingContacts } = useQuery<
    Contact[]
  >({
    queryKey: ["float-plan-contacts"],
    enabled: open,
    queryFn: async () => {
      try {
        const res = await fetch("/api/float-plan-contacts", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data: { contacts: Contact[] } = await res.json();
        dispatch({
          type: "selectionInitialized",
          ids: data.contacts.map((c) => c.id),
        });
        return data.contacts;
      } catch (error) {
        logger.error("Failed to load contacts", { error: String(error) });
        return [];
      }
    },
  });

  const handleOpenChange = (next: boolean) => {
    dispatch(next ? { type: "opened" } : { type: "closed" });
  };

  const toggle = (id: string, checked: boolean) => {
    dispatch({ type: "toggled", id, checked });
  };

  const handleSend = async () => {
    if (!passageId || selected.size === 0) return;
    dispatch({ type: "sendStarted" });
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
      dispatch({
        type: "sendSettled",
        result: {
          delivery: data.deliveryStatus ?? {},
          sentAt: data.sentAt ?? null,
        },
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
      dispatch({ type: "sendSettled", result: null });
      toast.error(
        error instanceof Error ? error.message : "Failed to send float plan",
      );
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
              authorities automatically; your contact is.
            </p>
          )}

          <DialogFooter>
            {result ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
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

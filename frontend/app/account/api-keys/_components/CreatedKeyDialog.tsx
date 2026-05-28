import { Copy } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { ApiKeyRow } from "./types";

interface CreatedKeyDialogProps {
  createdKey: { rawKey: string; row: ApiKeyRow } | null;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}

export function CreatedKeyDialog({
  createdKey,
  onClose,
  onCopy,
}: CreatedKeyDialogProps) {
  return (
    <Dialog
      open={createdKey !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save your API key now</DialogTitle>
          <DialogDescription>
            This is the only time the full key is shown. Lost keys cannot be
            recovered; you&apos;ll need to revoke and create a new one.
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
                  onClick={() => onCopy(createdKey.rawKey, "API key")}
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
          <Button onClick={onClose}>I&apos;ve saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

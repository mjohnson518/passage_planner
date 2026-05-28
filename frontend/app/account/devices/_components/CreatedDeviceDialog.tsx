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
import type { CreatedDeviceResponse } from "./types";

interface CreatedDeviceDialogProps {
  created: CreatedDeviceResponse | null;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}

export function CreatedDeviceDialog({
  created,
  onClose,
  onCopy,
}: CreatedDeviceDialogProps) {
  return (
    <Dialog open={created !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Device registered</DialogTitle>
          <DialogDescription>
            Save the webhook secret now; it is shown only once. To rotate,
            delete the device and re-add it.
          </DialogDescription>
        </DialogHeader>
        {created && (
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Webhook URL
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={created.webhookUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(created.webhookUrl, "URL")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Webhook secret (sign payloads with HMAC-SHA256)
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={created.device.webhook_secret}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onCopy(created.device.webhook_secret, "Secret")
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Vendor must POST a JSON body and include{" "}
              <code>X-Helmwise-Signature: sha256=&lt;hex&gt;</code> where the
              hex is HMAC-SHA256 of the raw body keyed by the secret above.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>I&apos;ve saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

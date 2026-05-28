import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { VENDOR_LABELS, type Vendor } from "./types";

export interface DeviceFormState {
  vendor: Vendor;
  deviceId: string;
  nickname: string;
}

interface AddDeviceFormProps {
  form: DeviceFormState;
  creating: boolean;
  onFieldChange: (patch: Partial<DeviceFormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function AddDeviceForm({
  form,
  creating,
  onFieldChange,
  onSubmit,
  onCancel,
}: AddDeviceFormProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">Add a device</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <select
              id="vendor"
              value={form.vendor}
              onChange={(e) =>
                onFieldChange({ vendor: e.target.value as Vendor })
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.entries(VENDOR_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            {form.vendor !== "generic" && (
              <p className="text-xs text-muted-foreground">
                This vendor adapter is in development. For now, register as
                &quot;Generic&quot; and use any tracker that can POST JSON.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="device_id">Device ID / IMEI</Label>
            <Input
              id="device_id"
              value={form.deviceId}
              onChange={(e) => onFieldChange({ deviceId: e.target.value })}
              placeholder="e.g. 300434060000000"
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname (optional)</Label>
            <Input
              id="nickname"
              value={form.nickname}
              onChange={(e) => onFieldChange({ nickname: e.target.value })}
              placeholder="Antares InReach"
              maxLength={100}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Adding…" : "Add device"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

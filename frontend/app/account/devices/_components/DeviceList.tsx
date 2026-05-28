import { MapPin, Radio, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { VENDOR_LABELS, type Device } from "./types";

interface DeviceListProps {
  loading: boolean;
  devices: Device[];
  onOpenPositions: (d: Device) => void;
  onDelete: (d: Device) => void;
}

export function DeviceList({
  loading,
  devices,
  onOpenPositions,
  onDelete,
}: DeviceListProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading devices…
          </div>
        ) : devices.length === 0 ? (
          <EmptyState
            icon={<Radio className="h-8 w-8" />}
            title="No devices registered"
            description="Register your first sat-comm device to start receiving position reports."
          />
        ) : (
          <ul className="divide-y divide-border">
            {devices.map((d) => (
              <li key={d.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{d.nickname ?? d.device_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {VENDOR_LABELS[d.vendor]} · {d.device_id}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.last_report_at
                        ? `Last report: ${new Date(d.last_report_at).toLocaleString()}`
                        : "No reports received yet"}
                      {d.deviation_state === "off" && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium">
                          Off-route
                        </span>
                      )}
                      {d.deviation_state === "on" && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-success/10 text-success px-2 py-0.5 text-xs font-medium">
                          On-route
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenPositions(d)}
                      aria-label="View positions"
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(d)}
                      aria-label="Delete device"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

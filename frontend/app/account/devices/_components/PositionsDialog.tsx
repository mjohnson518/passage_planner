import { Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { Device, PositionRow } from "./types";

interface PositionsDialogProps {
  positionsFor: Device | null;
  positions: PositionRow[];
  positionsLoading: boolean;
  onClose: () => void;
  onPurge: (d: Device) => void;
}

export function PositionsDialog({
  positionsFor,
  positions,
  positionsLoading,
  onClose,
  onPurge,
}: PositionsDialogProps) {
  return (
    <Dialog
      open={positionsFor !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Positions: {positionsFor?.nickname ?? positionsFor?.device_id ?? ""}
          </DialogTitle>
          <DialogDescription>
            Last 100 reports. Position data is retained for 90 days.
          </DialogDescription>
        </DialogHeader>
        {positionsLoading ? (
          <p className="py-6 text-sm text-muted-foreground text-center">
            Loading…
          </p>
        ) : positions.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground text-center">
            No position reports yet.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground sticky top-0 bg-background">
                <tr className="text-left">
                  <th className="py-2 pr-3">Time (UTC)</th>
                  <th className="py-2 pr-3">Lat</th>
                  <th className="py-2 pr-3">Lon</th>
                  <th className="py-2 pr-3">kt</th>
                  <th className="py-2">Bat</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-mono text-xs">
                      {new Date(p.reported_at)
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 16)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {p.lat.toFixed(4)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {p.lon.toFixed(4)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {p.speed_kn !== null ? p.speed_kn.toFixed(1) : "—"}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {p.battery_pct !== null ? `${p.battery_pct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter className="gap-2">
          {positionsFor && positions.length > 0 && (
            <Button variant="outline" onClick={() => onPurge(positionsFor)}>
              <Trash2 className="h-4 w-4 mr-2 text-destructive" />
              Clear all
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

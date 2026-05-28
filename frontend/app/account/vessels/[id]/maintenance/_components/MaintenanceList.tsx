import { CheckCircle2, Trash2, Wrench } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { cn } from "../../../../../lib/utils";
import {
  evaluate,
  STATUS_META,
  type MaintenanceItem,
  type Vessel,
} from "./types";

interface MaintenanceListProps {
  loading: boolean;
  items: MaintenanceItem[];
  vessel: Vessel | null;
  now: Date;
  onMarkServiced: (item: MaintenanceItem) => void;
  onDelete: (item: MaintenanceItem) => void;
}

export function MaintenanceList({
  loading,
  items,
  vessel,
  now,
  onMarkServiced,
  onDelete,
}: MaintenanceListProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading maintenance items…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-8 w-8" />}
            title="No maintenance items yet"
            description="Add items like oil changes, rigging inspections, or EPIRB battery checks to start tracking."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              if (!vessel) return null;
              const ev = evaluate(item, vessel, now);
              const meta = STATUS_META[ev.status];
              return (
                <li key={item.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{item.item}</p>
                        {item.category && (
                          <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            {item.category}
                          </span>
                        )}
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                            meta.classes,
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {ev.reason}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Interval:{" "}
                        {[
                          item.interval_days ? `${item.interval_days} d` : null,
                          item.interval_hours
                            ? `${item.interval_hours} h (${item.hours_meter_source})`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" or ")}
                        {item.last_serviced_at && (
                          <>
                            {" · last serviced "}
                            {new Date(
                              item.last_serviced_at,
                            ).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onMarkServiced(item)}
                        title="Mark as serviced now"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Serviced
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(item)}
                        aria-label="Delete item"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

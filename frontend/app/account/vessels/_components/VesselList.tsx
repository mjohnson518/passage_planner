import Link from "next/link";
import { Ship, Trash2, Wrench } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { EmptyState } from "../../../components/ui/empty-state";

export interface Vessel {
  id: string;
  name: string;
  current_engine_hours: number;
  current_watermaker_hours: number;
  created_at: string;
  updated_at: string;
}

interface VesselListProps {
  loading: boolean;
  vessels: Vessel[];
  onHoursChange: (
    vesselId: string,
    field: "current_engine_hours" | "current_watermaker_hours",
    value: string,
  ) => void;
  onDelete: (vessel: Vessel) => void;
}

export function VesselList({
  loading,
  vessels,
  onHoursChange,
  onDelete,
}: VesselListProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading vessels…
          </div>
        ) : vessels.length === 0 ? (
          <EmptyState
            icon={<Ship className="h-8 w-8" />}
            title="No vessels yet"
            description="Add your first vessel to start tracking maintenance items."
          />
        ) : (
          <ul className="divide-y divide-border">
            {vessels.map((v) => (
              <li key={v.id} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium">{v.name}</p>
                    <Link
                      href={`/account/vessels/${v.id}/maintenance`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <Wrench className="h-3 w-3" />
                      Open maintenance log
                    </Link>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(v)}
                    aria-label="Delete vessel"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label
                    htmlFor={`engine-hours-${v.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Engine hours
                    <Input
                      id={`engine-hours-${v.id}`}
                      type="number"
                      min="0"
                      step="0.1"
                      defaultValue={v.current_engine_hours}
                      onBlur={(e) =>
                        onHoursChange(
                          v.id,
                          "current_engine_hours",
                          e.target.value,
                        )
                      }
                      className="mt-1"
                    />
                  </label>
                  <label
                    htmlFor={`watermaker-hours-${v.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Watermaker hours
                    <Input
                      id={`watermaker-hours-${v.id}`}
                      type="number"
                      min="0"
                      step="0.1"
                      defaultValue={v.current_watermaker_hours}
                      onBlur={(e) =>
                        onHoursChange(
                          v.id,
                          "current_watermaker_hours",
                          e.target.value,
                        )
                      }
                      className="mt-1"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

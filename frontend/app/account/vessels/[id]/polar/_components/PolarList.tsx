import { CheckCircle2, Trash2, Wind } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { cn } from "../../../../../lib/utils";

export interface PolarRow {
  id: string;
  name: string;
  source: "upload" | "starter" | "edited";
  polar_data: {
    tws: number[];
    twa: number[];
    speeds: number[][];
  };
  is_active: boolean;
  max_wind_kt: number | null;
  max_wave_m: number | null;
  uploaded_at: string;
  updated_at: string;
}

interface PolarListProps {
  loading: boolean;
  polars: PolarRow[];
  onActivate: (polar: PolarRow) => void;
  onDelete: (polar: PolarRow) => void;
}

export function PolarList({
  loading,
  polars,
  onActivate,
  onDelete,
}: PolarListProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading polars…
          </div>
        ) : polars.length === 0 ? (
          <EmptyState
            icon={<Wind className="h-8 w-8" />}
            title="No polars uploaded"
            description="Upload an Expedition-format CSV to enable polar-tuned routing for this vessel."
          />
        ) : (
          <ul className="divide-y divide-border">
            {polars.map((p) => {
              const numTws = p.polar_data?.tws?.length ?? 0;
              const numTwa = p.polar_data?.twa?.length ?? 0;
              return (
                <li key={p.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{p.name}</p>
                        <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {p.source}
                        </span>
                        {p.is_active && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                              "text-success bg-success/10 border-success/30",
                            )}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {numTwa} TWA rows × {numTws} TWS columns
                        {p.max_wind_kt && ` · max wind ${p.max_wind_kt} kt`}
                        {p.max_wave_m && ` · max wave ${p.max_wave_m} m`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Uploaded {new Date(p.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!p.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onActivate(p)}
                        >
                          Set active
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(p)}
                        aria-label="Delete polar"
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

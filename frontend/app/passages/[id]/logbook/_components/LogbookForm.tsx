"use client";

import { Dispatch, SetStateAction } from "react";
import { Card, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import {
  ALL_TYPES,
  TYPE_META,
  type EntryType,
  type LogbookFormState,
} from "./types";

interface LogbookFormProps {
  form: LogbookFormState;
  setForm: Dispatch<SetStateAction<LogbookFormState>>;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function LogbookForm({
  form,
  setForm,
  submitting,
  onSubmit,
  onCancel,
}: LogbookFormProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">Add entry</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry_type">Type</Label>
              <select
                id="entry_type"
                value={form.entry_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    entry_type: e.target.value as EntryType,
                  })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="occurred_at">When it happened</Label>
              <Input
                id="occurred_at"
                type="datetime-local"
                value={form.occurred_at}
                onChange={(e) =>
                  setForm({ ...form, occurred_at: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recorded_by">Recorded by</Label>
              <Input
                id="recorded_by"
                value={form.recorded_by}
                onChange={(e) =>
                  setForm({ ...form, recorded_by: e.target.value })
                }
                placeholder="Capt. Marc"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position_lat">Lat (optional)</Label>
              <Input
                id="position_lat"
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={form.position_lat}
                onChange={(e) =>
                  setForm({ ...form, position_lat: e.target.value })
                }
                placeholder="50.7587"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position_lon">Lon (optional)</Label>
              <Input
                id="position_lon"
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={form.position_lon}
                onChange={(e) =>
                  setForm({ ...form, position_lon: e.target.value })
                }
                placeholder="-1.2982"
              />
            </div>
          </div>

          {/* Type-specific structured fields */}
          {form.entry_type === "engine" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="engine_hours">Engine hours</Label>
                <Input
                  id="engine_hours"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.engine_hours}
                  onChange={(e) =>
                    setForm({ ...form, engine_hours: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rpm">RPM (optional)</Label>
                <Input
                  id="rpm"
                  type="number"
                  min="0"
                  value={form.rpm}
                  onChange={(e) => setForm({ ...form, rpm: e.target.value })}
                />
              </div>
            </div>
          )}
          {form.entry_type === "fuel" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fuel_pct">Fuel %</Label>
                <Input
                  id="fuel_pct"
                  type="number"
                  min="0"
                  max="100"
                  value={form.fuel_pct}
                  onChange={(e) =>
                    setForm({ ...form, fuel_pct: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="water_pct">Water %</Label>
                <Input
                  id="water_pct"
                  type="number"
                  min="0"
                  max="100"
                  value={form.water_pct}
                  onChange={(e) =>
                    setForm({ ...form, water_pct: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          {form.entry_type === "weather" && (
            <div className="grid sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wind_kt">Wind (kt)</Label>
                <Input
                  id="wind_kt"
                  type="number"
                  min="0"
                  value={form.wind_kt}
                  onChange={(e) =>
                    setForm({ ...form, wind_kt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wind_dir">Wind dir</Label>
                <Input
                  id="wind_dir"
                  value={form.wind_dir}
                  onChange={(e) =>
                    setForm({ ...form, wind_dir: e.target.value })
                  }
                  placeholder="WSW"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waves_m">Waves (m)</Label>
                <Input
                  id="waves_m"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.waves_m}
                  onChange={(e) =>
                    setForm({ ...form, waves_m: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility_nm">Visibility (nm)</Label>
                <Input
                  id="visibility_nm"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.visibility_nm}
                  onChange={(e) =>
                    setForm({ ...form, visibility_nm: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          {(form.entry_type === "position" ||
            form.entry_type === "watch_handover") && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course">Course (deg)</Label>
                <Input
                  id="course"
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                  placeholder="245"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="speed_kt">Speed (kt)</Label>
                <Input
                  id="speed_kt"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.speed_kt}
                  onChange={(e) =>
                    setForm({ ...form, speed_kt: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          {form.entry_type === "watch_handover" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="watch_from">From watch</Label>
                <Input
                  id="watch_from"
                  value={form.watch_from}
                  onChange={(e) =>
                    setForm({ ...form, watch_from: e.target.value })
                  }
                  placeholder="Marc"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="watch_to">To watch</Label>
                <Input
                  id="watch_to"
                  value={form.watch_to}
                  onChange={(e) =>
                    setForm({ ...form, watch_to: e.target.value })
                  }
                  placeholder="Sam"
                  maxLength={50}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              aria-label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              maxLength={4000}
              placeholder="Squall passed quickly, wind clocked NW. Reefed main."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

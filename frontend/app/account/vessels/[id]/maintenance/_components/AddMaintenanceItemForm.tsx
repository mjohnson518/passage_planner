import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { CATEGORIES, type Category, type MeterSource } from "./types";

export interface MaintenanceFormState {
  item: string;
  category: Category;
  intervalDays: string;
  intervalHours: string;
  meterSource: MeterSource;
  lastServicedAt: string;
  lastServicedAtHours: string;
  notes: string;
}

interface AddMaintenanceItemFormProps {
  form: MaintenanceFormState;
  creating: boolean;
  onChange: (form: MaintenanceFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function AddMaintenanceItemForm({
  form,
  creating,
  onChange,
  onSubmit,
  onCancel,
}: AddMaintenanceItemFormProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">Add maintenance item</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item">Item</Label>
            <Input
              id="item"
              value={form.item}
              onChange={(e) => onChange({ ...form, item: e.target.value })}
              placeholder="Engine oil change"
              required
              maxLength={200}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) =>
                  onChange({
                    ...form,
                    category: e.target.value as Category,
                  })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="intervalDays">Interval (days)</Label>
              <Input
                id="intervalDays"
                type="number"
                min="1"
                value={form.intervalDays}
                onChange={(e) =>
                  onChange({ ...form, intervalDays: e.target.value })
                }
                placeholder="e.g. 365"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intervalHours">Interval (hours)</Label>
              <Input
                id="intervalHours"
                type="number"
                min="1"
                value={form.intervalHours}
                onChange={(e) =>
                  onChange({ ...form, intervalHours: e.target.value })
                }
                placeholder="e.g. 100"
              />
            </div>
          </div>
          {form.intervalHours && (
            <div className="space-y-2">
              <Label htmlFor="meter">Hours meter source</Label>
              <select
                id="meter"
                value={form.meterSource}
                onChange={(e) =>
                  onChange({
                    ...form,
                    meterSource: e.target.value as MeterSource,
                  })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="engine">Engine hours</option>
                <option value="watermaker">Watermaker hours</option>
              </select>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lastServicedAt">Last serviced (date)</Label>
              <Input
                id="lastServicedAt"
                type="date"
                value={form.lastServicedAt}
                onChange={(e) =>
                  onChange({ ...form, lastServicedAt: e.target.value })
                }
              />
            </div>
            {form.intervalHours && (
              <div className="space-y-2">
                <Label htmlFor="lastServicedAtHours">
                  Last serviced at (hours)
                </Label>
                <Input
                  id="lastServicedAtHours"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.lastServicedAtHours}
                  onChange={(e) =>
                    onChange({
                      ...form,
                      lastServicedAtHours: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              placeholder="Use Yanmar 15W-40 oil"
              maxLength={2000}
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
              {creating ? "Adding…" : "Add item"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

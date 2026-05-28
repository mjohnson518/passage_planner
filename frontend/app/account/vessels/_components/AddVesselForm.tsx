import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

export interface VesselFormState {
  name: string;
  engineHours: string;
  watermakerHours: string;
}

interface AddVesselFormProps {
  form: VesselFormState;
  creating: boolean;
  onChange: (form: VesselFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function AddVesselForm({
  form,
  creating,
  onChange,
  onSubmit,
  onCancel,
}: AddVesselFormProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">Add a vessel</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Antares"
              required
              maxLength={100}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="engine">Engine hours (current)</Label>
              <Input
                id="engine"
                type="number"
                min="0"
                step="0.1"
                value={form.engineHours}
                onChange={(e) =>
                  onChange({ ...form, engineHours: e.target.value })
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="watermaker">Watermaker hours (current)</Label>
              <Input
                id="watermaker"
                type="number"
                min="0"
                step="0.1"
                value={form.watermakerHours}
                onChange={(e) =>
                  onChange({ ...form, watermakerHours: e.target.value })
                }
                placeholder="0"
              />
            </div>
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
              {creating ? "Adding…" : "Add vessel"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

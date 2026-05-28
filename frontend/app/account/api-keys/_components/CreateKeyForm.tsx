import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type { ApiKeyFormState } from "./types";

interface CreateKeyFormProps {
  form: ApiKeyFormState;
  creating: boolean;
  onChange: (form: ApiKeyFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function CreateKeyForm({
  form,
  creating,
  onChange,
  onSubmit,
  onCancel,
}: CreateKeyFormProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">Create API key</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Chartplotter integration"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.scopes.read}
                  onChange={(e) =>
                    onChange({
                      ...form,
                      scopes: {
                        ...form.scopes,
                        read: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  <strong>read</strong>: list passages, fetch weather/tides
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.scopes.write}
                  onChange={(e) =>
                    onChange({
                      ...form,
                      scopes: {
                        ...form.scopes,
                        write: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  <strong>write</strong>: create/save passages, run planning
                </span>
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate">Rate limit (requests / day)</Label>
            <Input
              id="rate"
              type="number"
              min="1"
              max="1000000"
              value={form.rate_limit_per_day}
              onChange={(e) =>
                onChange({ ...form, rate_limit_per_day: e.target.value })
              }
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
              {creating ? "Creating…" : "Create key"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";

export interface PolarFormState {
  name: string;
  csv: string;
  max_wind_kt: string;
  max_wave_m: string;
}

interface UploadPolarFormProps {
  form: PolarFormState;
  submitting: boolean;
  onChange: (form: PolarFormState) => void;
  onFile: (file: File) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function UploadPolarForm({
  form,
  submitting,
  onChange,
  onFile,
  onSubmit,
  onCancel,
}: UploadPolarFormProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">Upload polar</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Stock polar"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <input
              id="csv-file"
              aria-label="CSV file"
              type="file"
              accept=".csv,.txt,.pol,text/csv,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="block w-full text-sm text-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80"
            />
            <p className="text-xs text-muted-foreground">
              Tab/semicolon/comma separated. First column is TWA, first row
              (after the label cell) is TWS values.
            </p>
          </div>
          {form.csv && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs font-mono max-h-40 overflow-auto whitespace-pre-wrap">
                {form.csv.split("\n").slice(0, 8).join("\n")}
                {form.csv.split("\n").length > 8 && "\n…"}
              </pre>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_wind">Max wind (kt, optional)</Label>
              <Input
                id="max_wind"
                type="number"
                min="0"
                max="100"
                value={form.max_wind_kt}
                onChange={(e) =>
                  onChange({ ...form, max_wind_kt: e.target.value })
                }
                placeholder="35"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_wave">Max wave (m, optional)</Label>
              <Input
                id="max_wave"
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={form.max_wave_m}
                onChange={(e) =>
                  onChange({ ...form, max_wave_m: e.target.value })
                }
                placeholder="3.5"
              />
            </div>
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
              {submitting ? "Uploading…" : "Upload polar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

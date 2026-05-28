import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

export interface FormState {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  relationship: string;
}

const RELATIONSHIPS = [
  "Spouse",
  "Family",
  "Co-skipper",
  "Friend",
  "Harbour authority",
  "Other",
];

interface ContactFormProps {
  form: FormState;
  editing: boolean;
  saving: boolean;
  onChange: (form: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function ContactForm({
  form,
  editing,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: ContactFormProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">
          {editing ? "Edit contact" : "Add emergency contact"}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => onChange({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
                required
                maxLength={254}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => onChange({ ...form, phone: e.target.value })}
                placeholder="+1 555 555 1212"
                maxLength={40}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship</Label>
              <select
                id="relationship"
                value={form.relationship}
                onChange={(e) =>
                  onChange({ ...form, relationship: e.target.value })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Choose…</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add contact"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { CERT_TYPE_LABELS, type CertType, type FormState } from "./types";

interface CertFormProps {
  form: FormState;
  submitting: boolean;
  onChange: (form: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function CertForm({
  form,
  submitting,
  onChange,
  onSubmit,
  onCancel,
}: CertFormProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">
          {form.id ? "Edit certification" : "Add certification"}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crew_name">Crew member</Label>
              <Input
                id="crew_name"
                value={form.crew_name}
                onChange={(e) =>
                  onChange({ ...form, crew_name: e.target.value })
                }
                placeholder="Capt. Marc Johnson"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert_type">Cert type</Label>
              <select
                id="cert_type"
                value={form.cert_type}
                onChange={(e) =>
                  onChange({
                    ...form,
                    cert_type: e.target.value as CertType,
                  })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {(Object.keys(CERT_TYPE_LABELS) as CertType[]).map((t) => (
                  <option key={t} value={t}>
                    {CERT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(form.cert_type === "uscg_master" || form.cert_type === "other") && (
            <div className="space-y-2">
              <Label htmlFor="cert_label">Specific cert name</Label>
              <Input
                id="cert_label"
                value={form.cert_label}
                onChange={(e) =>
                  onChange({ ...form, cert_label: e.target.value })
                }
                placeholder="USCG 100GT Master Inland/Near Coastal"
                maxLength={200}
              />
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issued_date">Issued</Label>
              <Input
                id="issued_date"
                type="date"
                value={form.issued_date}
                onChange={(e) =>
                  onChange({ ...form, issued_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Expires *</Label>
              <Input
                id="expiry_date"
                type="date"
                value={form.expiry_date}
                onChange={(e) =>
                  onChange({ ...form, expiry_date: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="issuing_authority">Issuing authority</Label>
            <Input
              id="issuing_authority"
              value={form.issuing_authority}
              onChange={(e) =>
                onChange({ ...form, issuing_authority: e.target.value })
              }
              placeholder="USCG, MCA, RYA, …"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document_url">Document URL (link only)</Label>
            <Input
              id="document_url"
              type="url"
              value={form.document_url}
              onChange={(e) =>
                onChange({ ...form, document_url: e.target.value })
              }
              placeholder="https://drive.google.com/…"
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              aria-label="Notes"
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              rows={2}
              maxLength={2000}
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
              {submitting ? "Saving…" : form.id ? "Save changes" : "Add cert"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

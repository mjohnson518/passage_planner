import { ExternalLink, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { cn } from "../../../lib/utils";
import { CERT_TYPE_LABELS, statusFor, type Certification } from "./types";

interface CertListProps {
  loading: boolean;
  certs: Certification[];
  now: Date;
  onEdit: (cert: Certification) => void;
  onDelete: (cert: Certification) => void;
}

export function CertList({
  loading,
  certs,
  now,
  onEdit,
  onDelete,
}: CertListProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading certifications…
          </div>
        ) : certs.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No certifications tracked"
            description="Add your first cert to start tracking expiry. The planner will warn you before departure if any crew cert is expired."
          />
        ) : (
          <ul className="divide-y divide-border">
            {certs.map((c) => {
              const status = statusFor(c.expiry_date, now);
              return (
                <li key={c.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {c.crew_name ?? "Crew member"}
                        </p>
                        <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {CERT_TYPE_LABELS[c.cert_type]}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                            status.classes,
                          )}
                        >
                          <status.Icon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </div>
                      {c.cert_label && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {c.cert_label}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {c.issuing_authority && `${c.issuing_authority} · `}
                        {c.issued_date && `Issued ${c.issued_date} · `}
                        Expires {c.expiry_date}
                      </p>
                      {c.document_url && (
                        <a
                          href={c.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Document
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(c)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(c)}
                        aria-label="Delete"
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

import { Key, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { cn } from "../../../lib/utils";
import type { ApiKeyRow } from "./types";

interface ApiKeyListProps {
  loading: boolean;
  keys: ApiKeyRow[];
  onRevoke: (key: ApiKeyRow) => void;
}

export function ApiKeyList({ loading, keys, onRevoke }: ApiKeyListProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading keys…
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={<Key className="h-8 w-8" />}
            title="No API keys yet"
            description="Create your first key to start calling Helmwise from your own scripts or integrations."
          />
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((k) => {
              const revoked = k.revoked_at !== null;
              return (
                <li key={k.id} className={cn("p-5", revoked && "opacity-60")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{k.name}</p>
                        {revoked ? (
                          <span className="text-xs rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-medium">
                            Revoked
                          </span>
                        ) : (
                          <span className="text-xs rounded-full bg-success/10 text-success px-2 py-0.5 font-medium">
                            Active
                          </span>
                        )}
                        {k.scopes.map((s) => (
                          <span
                            key={s}
                            className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono mt-1">
                        {k.key_prefix}…
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {k.rate_limit_per_day.toLocaleString()} req/day ·
                        created {new Date(k.created_at).toLocaleDateString()}
                        {k.last_used_at && (
                          <>
                            {" "}
                            · last used{" "}
                            {new Date(k.last_used_at).toLocaleDateString()}
                          </>
                        )}
                        {revoked && (
                          <>
                            {" "}
                            · revoked{" "}
                            {new Date(k.revoked_at!).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                    {!revoked && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRevoke(k)}
                        aria-label="Revoke key"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
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

import { AlertTriangle } from "lucide-react";

interface LoginAlertsProps {
  supabaseConfigured: boolean;
  formError: string | null;
}

export function LoginAlerts({
  supabaseConfigured,
  formError,
}: LoginAlertsProps) {
  return (
    <>
      {!supabaseConfigured && (
        <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Demo Mode Available</p>
            <p className="text-xs text-muted-foreground mt-1">
              Authentication is not configured. Use Demo Mode to explore.
            </p>
          </div>
        </div>
      )}

      {formError && (
        <div
          data-testid="login-error"
          className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg"
        >
          <p className="text-destructive text-sm">{formError}</p>
        </div>
      )}
    </>
  );
}

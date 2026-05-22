"use client";

import { useEffect } from "react";
import { Button } from "../components/ui/button";
import { logger } from "../lib/logger";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Admin error", {
      error: String(error),
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl text-center">
      <h1 className="text-2xl font-bold mb-2">Admin console unavailable</h1>
      <p className="text-muted-foreground mb-4">
        The admin console encountered an error. User data and orchestrator state
        are unaffected — this is a display issue only.
      </p>
      <p className="text-sm text-muted-foreground mb-6">
        Check the orchestrator <code>/health</code> endpoint and Sentry before
        retrying. If the error persists, escalate via the on-call channel.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button
          onClick={() => (window.location.href = "/dashboard")}
          variant="outline"
        >
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}

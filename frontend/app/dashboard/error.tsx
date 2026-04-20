"use client";

import { useEffect } from "react";
import { Button } from "../components/ui/button";
import { logger } from "../lib/logger";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Dashboard error", {
      error: String(error),
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl text-center">
      <h1 className="text-2xl font-bold mb-2">Dashboard unavailable</h1>
      <p className="text-muted-foreground mb-6">
        We couldn&apos;t load your dashboard. Please try again.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button onClick={() => (window.location.href = "/")} variant="outline">
          Go home
        </Button>
      </div>
    </div>
  );
}

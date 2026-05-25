"use client";

import { useEffect } from "react";
import { Compass } from "lucide-react";
import { Button } from "./components/ui/button";
import { logger } from "./lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Global error", {
      error: String(error),
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Compass className="h-8 w-8" />
        </div>
        <p className="font-mono-data text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Unexpected error
        </p>
        <h1 className="text-3xl font-bold tracking-tight font-display mb-3">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mb-2">
          The error has been logged. If this keeps happening, please{" "}
          <a href="/contact" className="underline hover:text-foreground">
            contact support
          </a>
          .
        </p>
        {error.digest && (
          <p className="font-mono-data text-xs text-muted-foreground mb-8">
            Reference:{" "}
            <span className="text-foreground/80">{error.digest}</span>
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>Try again</Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}

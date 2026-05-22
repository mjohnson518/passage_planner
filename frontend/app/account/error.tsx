"use client";

import { useEffect } from "react";
import { Button } from "../components/ui/button";
import { logger } from "../lib/logger";

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Account error", {
      error: String(error),
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl text-center">
      <h1 className="text-2xl font-bold mb-2">Account settings unavailable</h1>
      <p className="text-muted-foreground mb-4">
        We couldn&apos;t load your account page. Your profile, subscription, and
        saved data are unchanged.
      </p>
      <p className="text-sm text-muted-foreground mb-6">
        If this keeps happening, please{" "}
        <a href="/contact" className="underline">
          contact support
        </a>
        .
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

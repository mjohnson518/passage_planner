"use client";

/**
 * App Router global error boundary.
 *
 * Catches render errors in the root layout itself — the one place
 * `app/error.tsx` cannot reach. Without this file, React render errors
 * at the layout level bubble past every segment boundary and are never
 * reported to Sentry (the `@sentry/nextjs` 10.x build emits an explicit
 * warning about this).
 *
 * Must render its own `<html><body>` because the root layout is the
 * component that crashed — there is no parent shell to wrap us.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import NextError from "next/error";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}

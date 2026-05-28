"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../../../components/ui/banner";

export function FreeTierBanner() {
  return (
    <Banner variant="info">
      <BannerTitle>Read-only on Free tier</BannerTitle>
      <BannerDescription>
        You can view and PDF-export an existing logbook on Free. Adding new
        entries requires Premium.{" "}
        <Link
          href="/pricing"
          className="text-primary hover:underline font-medium"
        >
          Upgrade
        </Link>
      </BannerDescription>
    </Banner>
  );
}

export function AppendOnlyNote() {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2 text-xs text-muted-foreground">
      <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
      <p>
        Logbook entries are append-only. Past the 5-minute window, corrections
        are added as new entries; this matches maritime tradition and preserves
        the log&apos;s evidentiary value.
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowLeft, Download, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import type { TierState } from "./types";

interface LogbookHeaderProps {
  entriesCount: number;
  tier: TierState;
  showForm: boolean;
  onDownloadPdf: () => void;
  onAddEntry: () => void;
}

export function LogbookHeader({
  entriesCount,
  tier,
  showForm,
  onDownloadPdf,
  onAddEntry,
}: LogbookHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Dashboard
        </Link>
        <h1 className="font-display text-4xl mb-2">Logbook</h1>
        <p className="text-muted-foreground">
          Append-only record of this passage. Maritime tradition: once an entry
          is more than 5 minutes old, corrections are added as new entries.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {entriesCount > 0 && (
          <Button variant="outline" onClick={onDownloadPdf} size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        )}
        {tier === "premium" && !showForm && (
          <Button onClick={onAddEntry}>
            <Plus className="h-4 w-4 mr-2" />
            Add entry
          </Button>
        )}
      </div>
    </div>
  );
}

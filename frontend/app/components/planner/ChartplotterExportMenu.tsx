"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronDown, Download, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import type { PassageExport } from "../../types/shared";
import { logger } from "../../lib/logger";

type FormatId = "gpx" | "rtz" | "garmin" | "opencpn";

interface FormatMeta {
  id: FormatId;
  label: string;
  description: string;
  extension: string;
  mime: string;
  premium: boolean;
}

const FORMATS: FormatMeta[] = [
  {
    id: "gpx",
    label: "GPX (generic)",
    description: "Universal format — accepted by virtually every chartplotter.",
    extension: "gpx",
    mime: "application/gpx+xml",
    premium: false,
  },
  {
    id: "rtz",
    label: "RTZ — Raymarine / B&G / Simrad / Furuno",
    description: "ISO/IEC 17984 route exchange. Most modern ECDIS plotters.",
    extension: "rtz",
    mime: "application/vnd.rtz+xml",
    premium: true,
  },
  {
    id: "garmin",
    label: "Garmin GPX (GPSMAP / ECHOMAP)",
    description:
      "GPX with Garmin icon hints. NOT FIT — FIT is for fitness, not routes.",
    extension: "gpx",
    mime: "application/gpx+xml",
    premium: true,
  },
  {
    id: "opencpn",
    label: "OpenCPN GPX",
    description: "GPX with OpenCPN extensions for color and route GUID.",
    extension: "gpx",
    mime: "application/gpx+xml",
    premium: true,
  },
];

interface ChartplotterExportMenuProps {
  /** Pure factory — called when the user picks a format. Returns the
   *  PassageExport shape the format generators expect. Keeping this lazy
   *  means we don't redo the transform on every render. */
  buildPassage: () => PassageExport;
  /** Filename stem (no extension), e.g. "cowes-cherbourg". */
  filenameStem: string;
  /** Vessel name passed into the format-specific generators (used by RTZ
   *  routeInfo and Garmin metadata). Optional. */
  vesselName?: string;
}

export function ChartplotterExportMenu({
  buildPassage,
  filenameStem,
  vesselName,
}: ChartplotterExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // `null` while loading; `true`/`false` once the tier is known.
  const { data: isPremium = null } = useQuery<boolean>({
    queryKey: ["profile", "export-premium"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) return false;
        const data = (await res.json()) as { subscription_tier?: string };
        const tier = data.subscription_tier ?? "free";
        return tier !== "free";
      } catch {
        return false;
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const handlePick = async (fmt: FormatMeta) => {
    if (fmt.premium && isPremium === false) {
      toast.error(`${fmt.label} is a Premium export format.`, {
        action: {
          label: "Upgrade",
          onClick: () => {
            window.location.href = "/pricing";
          },
        },
      });
      return;
    }
    setBusy(true);
    setOpen(false);
    try {
      const passage = buildPassage();
      const content = await renderFormat(fmt.id, passage, vesselName);
      downloadBlob(content, `${filenameStem}.${fmt.extension}`, fmt.mime);
      toast.success(`${fmt.label} exported`);
    } catch (err) {
      logger.error("Chartplotter export failed", {
        format: fmt.id,
        error: String(err),
      });
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        data-testid="planner-export-menu"
        size="sm"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
      >
        <Download className="h-4 w-4 mr-2" />
        Export
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 ml-1 transition-transform",
            open && "rotate-180",
          )}
        />
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-80 rounded-md border border-border bg-card shadow-lg z-dropdown">
          <ul className="py-1">
            {FORMATS.map((fmt) => {
              const locked = fmt.premium && isPremium === false;
              return (
                <li key={fmt.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(fmt)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors",
                      locked && "opacity-80",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {fmt.label}
                          </span>
                          {fmt.premium && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
                              <Sparkles className="h-2.5 w-2.5" />
                              Premium
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmt.description}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {isPremium === false && (
            <div className="border-t border-border p-2 text-xs text-muted-foreground">
              <Link
                href="/pricing"
                className="text-primary hover:underline font-medium"
              >
                Upgrade to Premium
              </Link>{" "}
              to unlock chartplotter-native exports.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function renderFormat(
  id: FormatId,
  passage: PassageExport,
  vesselName?: string,
): Promise<string> {
  // Dynamic-import so we only ship the bytes of the format the user picks.
  switch (id) {
    case "gpx": {
      const { passageToGPX } = await import("../../lib/export/gpx");
      return passageToGPX(passage);
    }
    case "rtz": {
      const { passageToRTZ } = await import("../../lib/export/rtz");
      return passageToRTZ(passage, { vesselName });
    }
    case "garmin": {
      const { passageToGarminGPX } = await import(
        "../../lib/export/garmin-gpx"
      );
      return passageToGarminGPX(passage, { vesselName });
    }
    case "opencpn": {
      const { passageToOpenCPNGPX } = await import(
        "../../lib/export/opencpn-gpx"
      );
      return passageToOpenCPNGPX(passage);
    }
  }
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

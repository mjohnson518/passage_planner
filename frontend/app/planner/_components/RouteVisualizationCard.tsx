"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { SendFloatPlanButton } from "../../components/planner/SendFloatPlanButton";
import { SharePlanButton } from "../../components/planner/SharePlanButton";
import { ChartplotterExportMenu } from "../../components/planner/ChartplotterExportMenu";
import { features } from "../../lib/features";
import type { PassageExport } from "../../types/shared";
import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

// Dynamic import for map component to avoid SSR issues
const RouteMap = dynamic(() => import("../../components/map/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center">
      Loading map…
    </div>
  ),
});

interface RouteVisualizationCardProps {
  passagePlan: PassagePlanningResponse;
  departure: string;
  destination: string;
  boat: string;
  departureCoords: { latitude: number; longitude: number };
  destinationCoords: { latitude: number; longitude: number };
  savedPassageId: string | null;
  onSaved: (id: string) => void;
}

export function RouteVisualizationCard({
  passagePlan,
  departure,
  destination,
  boat,
  departureCoords,
  destinationCoords,
  savedPassageId,
  onSaved,
}: RouteVisualizationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Compass className="h-5 w-5" />
            Route Visualization
          </span>
          <div className="flex gap-2 flex-wrap">
            <Button
              data-testid="planner-save-passage"
              size="sm"
              variant="default"
              onClick={async () => {
                if (!passagePlan) return;
                try {
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/passages`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        name: `${departure} → ${destination}`,
                        plan: passagePlan,
                      }),
                    },
                  );
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const body = (await res.json().catch(() => ({}))) as {
                    passage?: { id?: string };
                  };
                  if (body.passage?.id) {
                    onSaved(body.passage.id);
                  }
                  toast.success("Passage saved to history");
                } catch (err) {
                  toast.error(
                    "Could not save passage. Sign in to enable history.",
                  );
                }
              }}
            >
              💾 Save
            </Button>
            <SendFloatPlanButton
              passageId={savedPassageId}
              departureLabel={departure}
              destinationLabel={destination}
            />
            <SharePlanButton passageId={savedPassageId} />
            {savedPassageId && (
              <Link href={`/passages/${savedPassageId}/logbook`}>
                <Button
                  size="sm"
                  variant="outline"
                  title="Open passage logbook"
                >
                  📖 Logbook
                </Button>
              </Link>
            )}
            {features.exportPassage && (
              <>
                {/* V4 — chartplotter-native exports. Replaces the single
                    GPX button; offers generic GPX (free) plus Premium
                    formats (RTZ for Raymarine/B&G/Simrad/Furuno,
                    Garmin-flavored GPX, OpenCPN GPX). */}
                <ChartplotterExportMenu
                  filenameStem={`${departure}-${destination}`}
                  vesselName={boat || undefined}
                  buildPassage={() => ({
                    name: `${departure} to ${destination}`,
                    waypoints: (passagePlan?.route?.waypoints ?? []).map(
                      (w: any) => ({
                        name: w.name ?? "Waypoint",
                        latitude: w.latitude,
                        longitude: w.longitude,
                        coordinates: {
                          lat: w.latitude,
                          lng: w.longitude,
                        },
                      }),
                    ),
                    departure: {
                      name: departure,
                      latitude: departureCoords.latitude,
                      longitude: departureCoords.longitude,
                      coordinates: {
                        lat: departureCoords.latitude,
                        lng: departureCoords.longitude,
                      },
                    },
                    destination: {
                      name: destination,
                      latitude: destinationCoords.latitude,
                      longitude: destinationCoords.longitude,
                      coordinates: {
                        lat: destinationCoords.latitude,
                        lng: destinationCoords.longitude,
                      },
                    },
                  })}
                />
                <Button
                  data-testid="planner-export-pdf"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (passagePlan) {
                      const { generatePassagePDF } = await import(
                        "../../lib/export/pdf"
                      );
                      generatePassagePDF({
                        name: `${departure} to ${destination}`,
                      } as PassageExport);
                      toast.success("PDF export started");
                    }
                  }}
                >
                  📄 PDF
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RouteMap
          waypoints={passagePlan.route.waypoints}
          center={[
            (departureCoords.latitude + destinationCoords.latitude) / 2,
            (departureCoords.longitude + destinationCoords.longitude) / 2,
          ]}
          zoom={6}
          height="400px"
        />
      </CardContent>
    </Card>
  );
}

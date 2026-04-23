"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";

export default function OfflinePage() {
  return (
    <div className="section-hero relative min-h-screen flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div
        className="absolute inset-0 chart-grid opacity-20 pointer-events-none"
        aria-hidden
      />

      <div className="relative text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted text-muted-foreground mb-8 shadow-maritime">
          <WifiOff className="h-8 w-8" />
        </div>

        <span className="badge-brass mb-4 inline-block">Offline Mode</span>
        <h1 className="font-display mt-4 text-3xl md:text-4xl mb-4">
          You&apos;re Offline
        </h1>
        <p className="text-muted-foreground mb-8">
          It looks like you&apos;ve lost your internet connection. Some features
          may not be available until you&apos;re back online.
        </p>

        {/* Safety warning — copy verbatim, life-safety critical, do not reword. */}
        <div className="rounded-md border-2 border-destructive bg-destructive/5 px-4 py-3 mb-6 text-left">
          <p className="font-bold text-destructive text-sm uppercase tracking-wider mb-1">
            ⚠ Navigation Safety Warning
          </p>
          <p className="text-destructive/80 text-sm">
            Cached weather and tidal data may be{" "}
            <strong>dangerously outdated</strong>. Do not use for navigation
            decisions without independent verification from official sources
            (NOAA, Coast Guard, VHF weather radio).
          </p>
        </div>

        <div className="space-y-6">
          <Button
            onClick={() => window.location.reload()}
            className="btn-brass w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>

          <div className="text-sm text-muted-foreground pt-4 border-t border-border/50">
            <p className="font-semibold mb-3 font-display text-foreground tracking-wide">
              Available Offline
            </p>
            <ul className="space-y-2 text-left max-w-xs mx-auto">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 flex-shrink-0">•</span>
                <span>View cached passages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 flex-shrink-0">•</span>
                <span>Access boat profiles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 flex-shrink-0">•</span>
                <span>
                  Review saved weather data (verify independently before use)
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

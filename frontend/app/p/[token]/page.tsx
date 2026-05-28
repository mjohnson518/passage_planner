import type { Metadata } from "next";
import Link from "next/link";
import { Anchor, MapPin, Navigation, Wind } from "lucide-react";

interface SharePayload {
  vessel: {
    name?: string;
    type?: string;
    length_ft?: number;
    color?: string;
  };
  passage: {
    name?: string;
    departure_port?: string;
    destination_port?: string;
    departure_time?: string;
    eta?: string;
    distance_nm?: number;
  };
  route: {
    waypoints: Array<{
      name?: string;
      lat?: number;
      lon?: number;
      eta?: string;
    }>;
  };
  weather_summary?: string;
  crew_count?: number;
  shared_by?: string;
  generated_at?: string;
}

// noindex + no-referrer at the document level so accidentally-shared URLs
// don't show up in Google and so clicks from the share page to third-party
// sites don't leak the token via Referer.
export const metadata: Metadata = {
  title: "Shared Passage · Helmwise",
  description: "A passage plan shared via Helmwise.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

async function loadShare(token: string): Promise<SharePayload | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  try {
    const res = await fetch(
      `${apiUrl}/api/share/${encodeURIComponent(token)}`,
      {
        // The public read endpoint allows brief caching server-side; on the
        // SSR side we always want fresh data so view counts are accurate.
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as SharePayload;
  } catch {
    return null;
  }
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

export default async function SharedPassagePage({
  params,
}: {
  params: { token: string };
}) {
  const payload = await loadShare(params.token);

  if (!payload) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Anchor className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl">Share link not found</h1>
          <p className="text-muted-foreground">
            This passage share link has expired, been revoked, or never existed.
            Ask the sender for an updated link.
          </p>
          <Link
            href="/"
            className="inline-block text-sm text-primary hover:underline"
          >
            Visit Helmwise →
          </Link>
        </div>
      </main>
    );
  }

  const { vessel, passage, route, weather_summary, shared_by } = payload;
  const distance =
    passage.distance_nm !== undefined
      ? `${passage.distance_nm.toFixed(1)} nm`
      : "—";

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-ocean-deep flex items-center justify-center">
              <Anchor className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">Helmwise</span>
          </Link>
          <span className="text-xs text-muted-foreground">Shared passage</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <section>
          <h1 className="font-display text-3xl mb-1">
            {vessel.name ?? "Vessel"}
          </h1>
          <p className="text-muted-foreground">
            {[
              vessel.type,
              vessel.length_ft && `${vessel.length_ft} ft`,
              vessel.color,
            ]
              .filter(Boolean)
              .join(" · ") || "Vessel details unavailable"}
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Navigation className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
            <div>
              <h2 className="font-display text-xl">
                {passage.departure_port ?? "—"} →{" "}
                {passage.destination_port ?? "—"}
              </h2>
              {passage.name && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {passage.name}
                </p>
              )}
            </div>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Departure</dt>
              <dd className="font-medium">
                {formatDateTime(passage.departure_time)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ETA</dt>
              <dd className="font-medium">{formatDateTime(passage.eta)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Distance</dt>
              <dd className="font-medium">{distance}</dd>
            </div>
            {payload.crew_count !== undefined && (
              <div>
                <dt className="text-muted-foreground">Crew on board</dt>
                <dd className="font-medium">{payload.crew_count}</dd>
              </div>
            )}
          </dl>
        </section>

        {route.waypoints.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-display text-lg mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Waypoints
            </h2>
            <ol className="space-y-2 text-sm">
              {route.waypoints.map((wp, i) => (
                <li
                  key={`${wp.name ?? ""}:${wp.lat ?? ""},${wp.lon ?? ""}`}
                  className="flex items-start justify-between gap-4 border-t border-border pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {wp.name ?? `Waypoint ${i + 1}`}
                    </p>
                    {wp.lat !== undefined && wp.lon !== undefined && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}
                      </p>
                    )}
                  </div>
                  {wp.eta && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(wp.eta)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {weather_summary && (
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-display text-lg mb-2 flex items-center gap-2">
              <Wind className="h-4 w-4 text-primary" />
              Weather notes
            </h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {weather_summary}
            </p>
          </section>
        )}

        <p className="text-sm text-center text-muted-foreground">
          {shared_by
            ? `Shared with you by ${shared_by}.`
            : "Shared with you via Helmwise."}{" "}
          This is a read-only snapshot from{" "}
          {formatDateTime(payload.generated_at)}.
        </p>

        <section className="rounded-lg bg-muted/40 border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Plan your own passages with AI-powered weather, tides, and safety
            analysis.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try Helmwise free
          </Link>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Anchor,
  BellOff,
  CheckCircle2,
  RotateCw,
  Smartphone,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../components/ui/banner";
import { cn } from "../lib/utils";
import { logger } from "../lib/logger";

// ============================================================================
// /anchor — anchor watch (free for all tiers; safety-critical)
//
// The math: alarm when the boat has been OUTSIDE the swing circle for N
// consecutive readings. The swing circle is centered on the drop point
// with user-configured radius. Accuracy-aware: alarm only fires when
// `distance - accuracy > radius` (i.e., outside even at GPS's most
// optimistic estimate) — civilian GPS noise is enough to false-trigger a
// strict comparison.
//
// Boats SWING on anchor — moving to the opposite side of the anchor with
// the wind is NORMAL, not drag. As long as you stay inside the swing
// circle, no alarm. Drag means the anchor has moved and the boat's swing
// is now centered somewhere else; the new arc takes you outside the
// original circle.
//
// Mobile-browser background throttling is the dominant limitation here.
// iOS Safari suspends JS when the screen locks or the user switches apps.
// We hold a screen WakeLock when watching, but the user must plug in and
// keep the tab foregrounded for the watch to actually run all night. The
// UI says this clearly.
// ============================================================================

const STORAGE_KEY = "helmwise.anchor-watch.v1";
const CONSECUTIVE_OUTSIDE_TO_ALARM = 3;
const MAX_HISTORY_POINTS = 200;
const TONE_FREQ_HZ = 880; // A5 — cuts through ambient noise
const BEEP_INTERVAL_MS = 1000; // 0.5s on / 0.5s off

// Anchor scope is typically 5:1 to 7:1 of depth. Presets cover quiet
// anchorage / typical / crowded. UI also surfaces "your depth × 1.5 + 15m
// buffer" math so users size the radius for their actual situation.
const RADIUS_PRESETS = [20, 50, 80] as const;

interface AnchorState {
  anchorLat: number;
  anchorLon: number;
  radiusMeters: number;
  droppedAt: number;
}

interface PositionReading {
  lat: number;
  lon: number;
  accuracyM: number;
  timestamp: number;
  distanceFromAnchorM: number;
}

type WatchStatus = "idle" | "watching" | "alarming";

// ----------------------------------------------------------------------------
// Math
// ----------------------------------------------------------------------------

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------

export default function AnchorWatchPage() {
  const [supported, setSupported] = useState<boolean>(true);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  const [radius, setRadius] = useState<number>(50);
  const [current, setCurrent] = useState<PositionReading | null>(null);
  const [history, setHistory] = useState<PositionReading[]>([]);
  const [status, setStatus] = useState<WatchStatus>("idle");

  const watchIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const consecutiveOutsideRef = useRef<number>(0);

  // ---- restore persisted state on mount ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported("geolocation" in navigator);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { anchor: AnchorState | null };
      if (parsed.anchor) {
        setAnchor(parsed.anchor);
        setRadius(parsed.anchor.radiusMeters);
        setStatus("watching");
      }
    } catch (err) {
      logger.warn("Failed to restore anchor state", { error: String(err) });
    }
  }, []);

  // ---- persist anchor changes ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ anchor }));
    } catch {
      // localStorage quota — non-fatal
    }
  }, [anchor]);

  // ---- audio alarm primitives ----
  const startAlarm = useCallback(() => {
    if (typeof window === "undefined") return;
    if (audioCtxRef.current) return; // already alarming
    try {
      const AudioCtxCtor =
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext ?? window.AudioContext;
      const ctx = new AudioCtxCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = TONE_FREQ_HZ;
      osc.type = "square";
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0;
      osc.start();
      audioCtxRef.current = ctx;
      oscillatorRef.current = osc;
      gainRef.current = gain;

      // 0.5s on / 0.5s off pattern via gain modulation. Square-wave tone at
      // 50% gain is loud enough to wake; well under the 1.0 hard-clip ceiling.
      let on = false;
      beepIntervalRef.current = setInterval(() => {
        on = !on;
        if (gainRef.current) gainRef.current.gain.value = on ? 0.5 : 0;
        if (on && "vibrate" in navigator) {
          // Vibrate is unsupported on iOS Safari — silently no-ops there.
          navigator.vibrate([500]);
        }
      }, BEEP_INTERVAL_MS / 2);
    } catch (err) {
      logger.error("Failed to start alarm", { error: String(err) });
    }
  }, []);

  const stopAlarm = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
    try {
      oscillatorRef.current?.stop();
      oscillatorRef.current?.disconnect();
      gainRef.current?.disconnect();
      audioCtxRef.current?.close();
    } catch {
      // ignore close errors
    }
    oscillatorRef.current = null;
    gainRef.current = null;
    audioCtxRef.current = null;
    if ("vibrate" in navigator) navigator.vibrate(0);
  }, []);

  // ---- wake lock (best-effort; many browsers don't support it) ----
  const acquireWakeLock = useCallback(async () => {
    try {
      const wl = (
        navigator as unknown as {
          wakeLock?: {
            request: (type: "screen") => Promise<WakeLockSentinel>;
          };
        }
      ).wakeLock;
      if (!wl) return;
      wakeLockRef.current = await wl.request("screen");
    } catch (err) {
      logger.warn("Wake lock failed", { error: String(err) });
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      /* ignore */
    }
    wakeLockRef.current = null;
  }, []);

  // ---- geolocation watch ----
  useEffect(() => {
    if (!anchor || status === "idle") {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    consecutiveOutsideRef.current = 0;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const reading: PositionReading = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          timestamp: Date.now(),
          distanceFromAnchorM: haversineMeters(
            anchor.anchorLat,
            anchor.anchorLon,
            pos.coords.latitude,
            pos.coords.longitude,
          ),
        };
        setCurrent(reading);
        setHistory((prev) => {
          const next = [...prev, reading];
          return next.length > MAX_HISTORY_POINTS
            ? next.slice(-MAX_HISTORY_POINTS)
            : next;
        });

        // Accuracy-aware: subtract GPS error so a noisy reading doesn't
        // tip a marginally-correct position into "outside" territory.
        const conservativeDistance =
          reading.distanceFromAnchorM - reading.accuracyM;
        if (conservativeDistance > anchor.radiusMeters) {
          consecutiveOutsideRef.current += 1;
          if (
            consecutiveOutsideRef.current >= CONSECUTIVE_OUTSIDE_TO_ALARM &&
            status !== "alarming"
          ) {
            setStatus("alarming");
            startAlarm();
          }
        } else {
          consecutiveOutsideRef.current = 0;
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
        logger.warn("watchPosition error", {
          code: err.code,
          message: err.message,
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [anchor, status, startAlarm]);

  // ---- alarm cleanup when leaving the page ----
  useEffect(() => {
    return () => {
      stopAlarm();
      releaseWakeLock();
    };
  }, [stopAlarm, releaseWakeLock]);

  // ---- one-shot current position helper for "drop anchor" ----
  const getCurrentPosition = useCallback(() => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    });
  }, []);

  const handleDropAnchor = async () => {
    try {
      const pos = await getCurrentPosition();
      const newAnchor: AnchorState = {
        anchorLat: pos.coords.latitude,
        anchorLon: pos.coords.longitude,
        radiusMeters: radius,
        droppedAt: Date.now(),
      };
      setAnchor(newAnchor);
      setHistory([]);
      setStatus("watching");
      consecutiveOutsideRef.current = 0;
      await acquireWakeLock();
    } catch (err) {
      const code = (err as GeolocationPositionError).code;
      if (code === 1) setPermissionDenied(true);
      logger.error("Drop anchor failed", { error: String(err) });
    }
  };

  const handleWeighAnchor = async () => {
    stopAlarm();
    await releaseWakeLock();
    setAnchor(null);
    setStatus("idle");
    setHistory([]);
    setCurrent(null);
    consecutiveOutsideRef.current = 0;
  };

  const handleAcknowledgeAlarm = () => {
    stopAlarm();
    setStatus("watching");
    consecutiveOutsideRef.current = 0;
  };

  // ---- derived display values ----
  const distance = current?.distanceFromAnchorM ?? null;
  const accuracy = current?.accuracyM ?? null;
  const outsideAmount =
    distance !== null && accuracy !== null
      ? distance - accuracy - (anchor?.radiusMeters ?? 0)
      : null;

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="font-display text-4xl mb-2">Anchor watch</h1>
            <p className="text-muted-foreground">
              Sets a swing circle at the drop point and alarms if your GPS
              position leaves it for {CONSECUTIVE_OUTSIDE_TO_ALARM} consecutive
              readings (accuracy-aware).
            </p>
          </div>

          {!supported && (
            <Banner variant="warning">
              <BannerTitle>Geolocation not supported</BannerTitle>
              <BannerDescription>
                This browser cannot access GPS. Use a modern Chrome, Safari, or
                Firefox on a device with location services enabled.
              </BannerDescription>
            </Banner>
          )}

          {permissionDenied && (
            <Banner variant="warning">
              <BannerTitle>Location permission denied</BannerTitle>
              <BannerDescription>
                Helmwise can&apos;t watch your anchor without GPS. Enable
                location for this site in your browser settings and reload.
              </BannerDescription>
            </Banner>
          )}

          {/* Status hero */}
          <Card
            className={cn(
              "border-2",
              status === "alarming" &&
                "border-destructive bg-destructive/5 animate-pulse",
              status === "watching" && "border-success/40 bg-success/5",
              status === "idle" && "border-border",
            )}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border-2",
                    status === "alarming" &&
                      "border-destructive bg-destructive/10 text-destructive",
                    status === "watching" &&
                      "border-success bg-success/10 text-success",
                    status === "idle" &&
                      "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {status === "alarming" ? (
                    <AlertTriangle className="h-7 w-7" />
                  ) : status === "watching" ? (
                    <CheckCircle2 className="h-7 w-7" />
                  ) : (
                    <Anchor className="h-7 w-7" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-2xl">
                    {status === "alarming"
                      ? "ANCHOR DRAGGING"
                      : status === "watching"
                        ? "Anchored — watching"
                        : "Idle"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {status === "alarming"
                      ? "Outside swing circle. Check anchor immediately."
                      : status === "watching" && anchor
                        ? `Dropped ${formatTime(anchor.droppedAt)} · radius ${anchor.radiusMeters}m`
                        : "Drop the anchor when you're set."}
                  </p>
                </div>
              </div>

              {/* Distance vs radius readout */}
              {status !== "idle" && distance !== null && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {distance.toFixed(1)}
                      <span className="text-sm text-muted-foreground"> m</span>
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Radius</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {anchor?.radiusMeters ?? 0}
                      <span className="text-sm text-muted-foreground"> m</span>
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">GPS ±</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {accuracy !== null ? accuracy.toFixed(0) : "—"}
                      <span className="text-sm text-muted-foreground"> m</span>
                    </p>
                  </div>
                </div>
              )}

              {/* SVG swing-circle visualization */}
              {anchor && current && (
                <SwingCircle
                  radiusMeters={anchor.radiusMeters}
                  distanceMeters={distance ?? 0}
                  bearing={bearingDeg(
                    anchor.anchorLat,
                    anchor.anchorLon,
                    current.lat,
                    current.lon,
                  )}
                  alarming={status === "alarming"}
                />
              )}

              {/* Controls */}
              <div className="flex flex-wrap gap-2 justify-end">
                {status === "alarming" && (
                  <Button onClick={handleAcknowledgeAlarm} variant="outline">
                    <BellOff className="h-4 w-4 mr-2" />
                    Silence alarm
                  </Button>
                )}
                {status === "idle" ? (
                  <Button
                    onClick={handleDropAnchor}
                    disabled={!supported || permissionDenied}
                    className="font-semibold"
                  >
                    <Anchor className="h-4 w-4 mr-2" />
                    Drop anchor
                  </Button>
                ) : (
                  <Button onClick={handleWeighAnchor} variant="outline">
                    <RotateCw className="h-4 w-4 mr-2" />
                    Weigh anchor
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Radius picker (only when idle) */}
          {status === "idle" && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="font-medium text-sm">
                    Swing radius: {radius} m
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aim for{" "}
                    <span className="font-mono">
                      1.5 × scope × depth + 15m GPS buffer
                    </span>
                    . Tight anchorages may need smaller; deep or windy
                    anchorages need more.
                  </p>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="5"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex gap-2">
                  {RADIUS_PRESETS.map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={radius === r ? "default" : "outline"}
                      onClick={() => setRadius(r)}
                    >
                      {r} m
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Honest mobile-throttling disclaimer */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-sm">
                  <p className="font-medium">
                    Keep this tab in the foreground.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>
                      Mobile browsers throttle (or suspend) JavaScript when the
                      screen locks or you switch apps. Helmwise holds a screen
                      Wake Lock where supported, but
                      <strong> plug in</strong> and set Auto-Lock to{" "}
                      <strong>Never</strong> (iOS Settings) for overnight watch.
                    </li>
                    <li>
                      Vibrate is not supported on iOS Safari — audio alarm only
                      on iPhone. Test volume before relying on it.
                    </li>
                    <li>
                      <strong>This is decision support.</strong> Verify anchor
                      holding by traditional means too (transit bearings, depth
                      changes, anchor-buoy alignment).
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent position history */}
          {history.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b border-border">
                  <p className="font-medium text-sm">Recent positions</p>
                  <p className="text-xs text-muted-foreground">
                    {history.length} reading
                    {history.length === 1 ? "" : "s"} since drop.
                  </p>
                </div>
                <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                  {history
                    .slice(-30)
                    .reverse()
                    .map((p, i) => {
                      const outside =
                        anchor &&
                        p.distanceFromAnchorM - p.accuracyM >
                          anchor.radiusMeters;
                      return (
                        <li
                          key={`${p.timestamp}-${i}`}
                          className="px-5 py-2 flex items-center gap-3 text-xs"
                        >
                          <span className="text-muted-foreground font-mono w-20">
                            {formatTime(p.timestamp)}
                          </span>
                          <span
                            className={cn(
                              "font-mono w-16 text-right tabular-nums",
                              outside && "text-destructive font-semibold",
                            )}
                          >
                            {p.distanceFromAnchorM.toFixed(1)} m
                          </span>
                          <span className="text-muted-foreground font-mono">
                            ±{p.accuracyM.toFixed(0)} m
                          </span>
                          {outside && (
                            <span className="ml-auto text-destructive text-xs">
                              outside
                            </span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// SwingCircle — SVG visualisation of boat vs anchor circle
// ----------------------------------------------------------------------------
function SwingCircle({
  radiusMeters,
  distanceMeters,
  bearing,
  alarming,
}: {
  radiusMeters: number;
  distanceMeters: number;
  bearing: number;
  alarming: boolean;
}) {
  // Scale the view so the circle fills most of the SVG; clamp very-distant
  // boats so the dot stays visible on the edge instead of off-canvas.
  const viewRadius = 100;
  const center = 120;
  const scale = viewRadius / Math.max(radiusMeters, distanceMeters * 1.1);
  const boatX =
    center + Math.sin((bearing * Math.PI) / 180) * distanceMeters * scale;
  const boatY =
    center - Math.cos((bearing * Math.PI) / 180) * distanceMeters * scale;

  return (
    <svg
      viewBox="0 0 240 240"
      className="w-full max-w-[280px] mx-auto"
      aria-label="Anchor swing circle visualization"
    >
      {/* Compass cross */}
      <line
        x1={center}
        y1={10}
        x2={center}
        y2={230}
        stroke="currentColor"
        strokeOpacity="0.08"
      />
      <line
        x1={10}
        y1={center}
        x2={230}
        y2={center}
        stroke="currentColor"
        strokeOpacity="0.08"
      />
      {/* Swing circle */}
      <circle
        cx={center}
        cy={center}
        r={radiusMeters * scale}
        fill="none"
        stroke={alarming ? "rgb(239 68 68)" : "rgb(34 197 94)"}
        strokeOpacity="0.5"
        strokeDasharray="4 4"
        strokeWidth="2"
      />
      {/* Anchor mark */}
      <circle cx={center} cy={center} r={4} fill="currentColor" />
      <text
        x={center + 8}
        y={center + 14}
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
      >
        ⚓
      </text>
      {/* Boat position */}
      <circle
        cx={boatX}
        cy={boatY}
        r={6}
        fill={alarming ? "rgb(239 68 68)" : "rgb(14 165 233)"}
      />
      <line
        x1={center}
        y1={center}
        x2={boatX}
        y2={boatY}
        stroke={alarming ? "rgb(239 68 68)" : "currentColor"}
        strokeOpacity={alarming ? "0.6" : "0.2"}
        strokeWidth="1.5"
      />
      <text x={5} y={15} fontSize="9" fill="currentColor" opacity="0.4">
        N
      </text>
    </svg>
  );
}

function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const dλ = toRad(lon2 - lon1);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

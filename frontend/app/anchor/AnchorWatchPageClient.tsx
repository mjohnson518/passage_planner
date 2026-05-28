"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Header } from "../components/layout/Header";
import { logger } from "../lib/logger";
import { StatusHero } from "./_components/StatusHero";
import { RadiusPicker } from "./_components/RadiusPicker";
import { ThrottlingDisclaimer } from "./_components/ThrottlingDisclaimer";
import { PositionHistory } from "./_components/PositionHistory";
import { PageIntro } from "./_components/PageIntro";
import { GeolocationUnsupportedBanner } from "./_components/GeolocationUnsupportedBanner";
import { PermissionDeniedBanner } from "./_components/PermissionDeniedBanner";
import type {
  AnchorState,
  PositionReading,
  WatchStatus,
} from "./_components/lib";
import { haversineMeters } from "./_components/geo";

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

// ----------------------------------------------------------------------------
// Persisted-state restore (read once, synchronously, for lazy initializers)
// ----------------------------------------------------------------------------
interface RestoredState {
  anchor: AnchorState | null;
  radius: number;
  status: WatchStatus;
}

function readPersistedState(): RestoredState {
  const fallback: RestoredState = {
    anchor: null,
    radius: 50,
    status: "idle",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { anchor: AnchorState | null };
    if (parsed.anchor) {
      return {
        anchor: parsed.anchor,
        radius: parsed.anchor.radiusMeters,
        status: "watching",
      };
    }
  } catch (err) {
    logger.warn("Failed to restore anchor state", { error: String(err) });
  }
  return fallback;
}

// ----------------------------------------------------------------------------
// Watch-session reducer — anchor / status / current / history move together.
// The reducer is PURE: alarm side effects (audio, ref counters) stay in the
// geolocation watch effect; this only commits the resulting display state.
// ----------------------------------------------------------------------------
interface WatchState {
  anchor: AnchorState | null;
  status: WatchStatus;
  current: PositionReading | null;
  history: PositionReading[];
}

type WatchAction =
  | { type: "positionReading"; reading: PositionReading; alarming: boolean }
  | { type: "dropAnchor"; anchor: AnchorState }
  | { type: "weighAnchor" }
  | { type: "acknowledgeAlarm" };

function watchReducer(state: WatchState, action: WatchAction): WatchState {
  switch (action.type) {
    case "positionReading": {
      const next = [...state.history, action.reading];
      const history =
        next.length > MAX_HISTORY_POINTS
          ? next.slice(-MAX_HISTORY_POINTS)
          : next;
      return {
        ...state,
        current: action.reading,
        history,
        status: action.alarming ? "alarming" : state.status,
      };
    }
    case "dropAnchor":
      return {
        ...state,
        anchor: action.anchor,
        history: [],
        status: "watching",
      };
    case "weighAnchor":
      return { anchor: null, status: "idle", history: [], current: null };
    case "acknowledgeAlarm":
      return { ...state, status: "watching" };
    default:
      return state;
  }
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------

export default function AnchorWatchPageClient() {
  // Capability flags are independent of the watch session.
  const [supported] = useState<boolean>(() =>
    typeof window !== "undefined" ? "geolocation" in navigator : true,
  );
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  // Radius is the idle-mode picker value; restored from persisted anchor.
  const [radius, setRadius] = useState<number>(
    () => readPersistedState().radius,
  );

  // Watch-session state (anchor / status / current / history) is grouped so
  // related transitions commit in a single dispatch.
  const [watch, dispatch] = useReducer(
    watchReducer,
    undefined,
    (): WatchState => {
      const restored = readPersistedState();
      return {
        anchor: restored.anchor,
        status: restored.status,
        current: null,
        history: [],
      };
    },
  );
  const { anchor, status, current, history } = watch;

  const watchIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const consecutiveOutsideRef = useRef<number>(0);

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

        // Accuracy-aware: subtract GPS error so a noisy reading doesn't
        // tip a marginally-correct position into "outside" territory.
        const conservativeDistance =
          reading.distanceFromAnchorM - reading.accuracyM;
        let triggerAlarm = false;
        if (conservativeDistance > anchor.radiusMeters) {
          consecutiveOutsideRef.current += 1;
          if (
            consecutiveOutsideRef.current >= CONSECUTIVE_OUTSIDE_TO_ALARM &&
            status !== "alarming"
          ) {
            triggerAlarm = true;
          }
        } else {
          consecutiveOutsideRef.current = 0;
        }
        if (triggerAlarm) startAlarm();
        dispatch({ type: "positionReading", reading, alarming: triggerAlarm });
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
      consecutiveOutsideRef.current = 0;
      dispatch({ type: "dropAnchor", anchor: newAnchor });
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
    consecutiveOutsideRef.current = 0;
    dispatch({ type: "weighAnchor" });
  };

  const handleAcknowledgeAlarm = () => {
    stopAlarm();
    consecutiveOutsideRef.current = 0;
    dispatch({ type: "acknowledgeAlarm" });
  };

  // ---- derived display values ----
  const distance = current?.distanceFromAnchorM ?? null;
  const accuracy = current?.accuracyM ?? null;

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <PageIntro consecutiveOutsideToAlarm={CONSECUTIVE_OUTSIDE_TO_ALARM} />

          {!supported && <GeolocationUnsupportedBanner />}

          {permissionDenied && <PermissionDeniedBanner />}

          {/* Status hero */}
          <StatusHero
            status={status}
            anchor={anchor}
            current={current}
            distance={distance}
            accuracy={accuracy}
            supported={supported}
            permissionDenied={permissionDenied}
            onAcknowledge={handleAcknowledgeAlarm}
            onDrop={handleDropAnchor}
            onWeigh={handleWeighAnchor}
          />

          {/* Radius picker (only when idle) */}
          {status === "idle" && (
            <RadiusPicker radius={radius} onRadiusChange={setRadius} />
          )}

          {/* Honest mobile-throttling disclaimer */}
          <ThrottlingDisclaimer />

          {/* Recent position history */}
          {history.length > 0 && (
            <PositionHistory history={history} anchor={anchor} />
          )}
        </div>
      </div>
    </>
  );
}

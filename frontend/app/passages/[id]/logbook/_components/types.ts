export type EntryType =
  | "departure"
  | "arrival"
  | "position"
  | "watch_handover"
  | "weather"
  | "engine"
  | "fuel"
  | "event"
  | "note";

export interface LogbookEntry {
  id: string;
  passage_id: string;
  vessel_id: string | null;
  entry_type: EntryType;
  occurred_at: string;
  recorded_at: string;
  recorded_by: string | null;
  position_lat: number | null;
  position_lon: number | null;
  conditions: Record<string, unknown> | null;
  notes: string | null;
}

export type TierState = "loading" | "free" | "premium";

export interface LogbookFormState {
  entry_type: EntryType;
  occurred_at: string;
  recorded_by: string;
  position_lat: string;
  position_lon: string;
  notes: string;
  // Type-specific structured fields (only the relevant ones surface in the
  // form for each chosen entry_type).
  engine_hours: string;
  rpm: string;
  fuel_pct: string;
  water_pct: string;
  wind_kt: string;
  wind_dir: string;
  waves_m: string;
  visibility_nm: string;
  course: string;
  speed_kt: string;
  watch_from: string;
  watch_to: string;
}

export const TYPE_META: Record<EntryType, { label: string; classes: string }> =
  {
    departure: {
      label: "DEPARTURE",
      classes: "bg-primary/10 text-primary border-primary/30",
    },
    arrival: {
      label: "ARRIVAL",
      classes: "bg-success/10 text-success border-success/30",
    },
    position: {
      label: "POSITION",
      classes: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    },
    watch_handover: {
      label: "WATCH HANDOVER",
      classes: "bg-purple-500/10 text-purple-700 border-purple-500/30",
    },
    weather: {
      label: "WEATHER",
      classes: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    },
    engine: {
      label: "ENGINE",
      classes: "bg-orange-500/10 text-orange-700 border-orange-500/30",
    },
    fuel: {
      label: "FUEL/WATER",
      classes: "bg-teal-500/10 text-teal-700 border-teal-500/30",
    },
    event: {
      label: "EVENT",
      classes: "bg-destructive/10 text-destructive border-destructive/30",
    },
    note: {
      label: "NOTE",
      classes: "bg-muted text-muted-foreground border-border",
    },
  };

export const ALL_TYPES: EntryType[] = [
  "position",
  "watch_handover",
  "weather",
  "engine",
  "fuel",
  "event",
  "note",
  "arrival",
];

export function isWithin5Min(iso: string): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < 5 * 60 * 1000;
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

export function formatPosition(lat: number, lon: number): string {
  const latH = lat >= 0 ? "N" : "S";
  const lonH = lon >= 0 ? "E" : "W";
  const aLat = Math.abs(lat);
  const aLon = Math.abs(lon);
  const latDeg = Math.floor(aLat);
  const lonDeg = Math.floor(aLon);
  const latMin = (aLat - latDeg) * 60;
  const lonMin = (aLon - lonDeg) * 60;
  return `${latDeg}° ${latMin.toFixed(1)}' ${latH} / ${lonDeg}° ${lonMin.toFixed(1)}' ${lonH}`;
}

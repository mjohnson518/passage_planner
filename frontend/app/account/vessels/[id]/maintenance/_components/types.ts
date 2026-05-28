export type Category =
  | "engine"
  | "watermaker"
  | "rigging"
  | "safety"
  | "sails"
  | "hull"
  | "electrical"
  | "other";

export type MeterSource = "engine" | "watermaker";

export interface MaintenanceItem {
  id: string;
  item: string;
  category: Category | null;
  interval_hours: number | null;
  interval_days: number | null;
  hours_meter_source: MeterSource | null;
  last_serviced_at: string | null;
  last_serviced_at_hours: number | null;
  notes: string | null;
}

export interface Vessel {
  id: string;
  name: string;
  current_engine_hours: number;
  current_watermaker_hours: number;
}

export type Status = "ok" | "due_soon" | "overdue";

export interface Evaluation {
  status: Status;
  daysUntilDue: number | null;
  hoursUntilDue: number | null;
  reason: string;
}

const DUE_SOON_FRACTION = 0.2;

// Mirrors agents/safety/src/risk-score:scoreToStatus and MaintenanceMonitor:
// "overdue" if past either interval, "due_soon" if within 20% of either,
// else "ok". Duplicated here so the UI doesn't need a round-trip per item.
export function evaluate(
  item: MaintenanceItem,
  vessel: Vessel,
  now: Date,
): Evaluation {
  if (item.last_serviced_at === null) {
    return {
      status: "overdue",
      daysUntilDue: null,
      hoursUntilDue: null,
      reason: "Never serviced — record a baseline service to start tracking.",
    };
  }
  const lastMs = new Date(item.last_serviced_at).getTime();
  if (!Number.isFinite(lastMs)) {
    return {
      status: "overdue",
      daysUntilDue: null,
      hoursUntilDue: null,
      reason: "Invalid last-serviced timestamp.",
    };
  }

  let daysUntilDue: number | null = null;
  let hoursUntilDue: number | null = null;
  const reasons: string[] = [];

  if (item.interval_days !== null) {
    const elapsedDays = (now.getTime() - lastMs) / (24 * 60 * 60 * 1000);
    daysUntilDue = item.interval_days - elapsedDays;
    if (daysUntilDue <= 0) {
      reasons.push(`${Math.round(-daysUntilDue)} days overdue`);
    }
  }
  if (item.interval_hours !== null && item.hours_meter_source !== null) {
    const baseline = item.last_serviced_at_hours ?? 0;
    const current =
      item.hours_meter_source === "engine"
        ? vessel.current_engine_hours
        : vessel.current_watermaker_hours;
    hoursUntilDue = item.interval_hours - (current - baseline);
    if (hoursUntilDue <= 0) {
      reasons.push(`${Math.round(-hoursUntilDue)} h overdue`);
    }
  }
  if (reasons.length > 0) {
    return {
      status: "overdue",
      daysUntilDue,
      hoursUntilDue,
      reason: reasons.join("; "),
    };
  }

  const daysSoon =
    daysUntilDue !== null &&
    item.interval_days !== null &&
    daysUntilDue / item.interval_days <= DUE_SOON_FRACTION;
  const hoursSoon =
    hoursUntilDue !== null &&
    item.interval_hours !== null &&
    hoursUntilDue / item.interval_hours <= DUE_SOON_FRACTION;

  if (daysSoon || hoursSoon) {
    const parts: string[] = [];
    if (daysSoon && daysUntilDue !== null)
      parts.push(`due in ${Math.round(daysUntilDue)} days`);
    if (hoursSoon && hoursUntilDue !== null)
      parts.push(`due in ${Math.round(hoursUntilDue)} h`);
    return {
      status: "due_soon",
      daysUntilDue,
      hoursUntilDue,
      reason: parts.join(", "),
    };
  }

  return {
    status: "ok",
    daysUntilDue,
    hoursUntilDue,
    reason: "Within service interval.",
  };
}

export const STATUS_META: Record<Status, { label: string; classes: string }> = {
  ok: {
    label: "OK",
    classes: "text-success bg-success/10 border-success/30",
  },
  due_soon: {
    label: "Due soon",
    classes: "text-warning bg-warning/10 border-warning/30",
  },
  overdue: {
    label: "Overdue",
    classes: "text-destructive bg-destructive/10 border-destructive/30",
  },
};

export const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: "engine", label: "Engine" },
  { id: "watermaker", label: "Watermaker" },
  { id: "rigging", label: "Rigging" },
  { id: "safety", label: "Safety gear" },
  { id: "sails", label: "Sails" },
  { id: "hull", label: "Hull" },
  { id: "electrical", label: "Electrical" },
  { id: "other", label: "Other" },
];

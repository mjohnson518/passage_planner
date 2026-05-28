export type Vendor = "generic" | "garmin_inreach" | "iridiumgo" | "yb_tracking";

export interface Device {
  id: string;
  vendor: Vendor;
  device_id: string;
  nickname: string | null;
  deviation_state: "on" | "off" | null;
  last_report_at: string | null;
  created_at: string;
}

export interface PositionRow {
  id: string;
  reported_at: string;
  received_at: string;
  lat: number;
  lon: number;
  speed_kn: number | null;
  course_deg: number | null;
  battery_pct: number | null;
  message_text: string | null;
}

export interface CreatedDeviceResponse {
  device: Device & { webhook_secret: string };
  webhookUrl: string;
}

export const VENDOR_LABELS: Record<Vendor, string> = {
  generic: "Generic (Helmwise format)",
  garmin_inreach: "Garmin InReach (coming soon)",
  iridiumgo: "IridiumGo (coming soon)",
  yb_tracking: "YB Tracking (coming soon)",
};

import * as crypto from "crypto";

// ============================================================================
// Vendor adapters for sat-comm webhooks.
//
// Each vendor delivers position data in its own payload shape. Adapters
// translate the vendor-specific shape to the canonical `NormalisedPosition`
// the rest of the service understands, and verify the request's authenticity
// using vendor-appropriate signing.
//
// v1 of S2 ships the "generic" adapter end-to-end (HMAC-SHA256 over the raw
// body keyed by device.webhook_secret — the standard pattern most webhook
// platforms use). Vendor adapters are stubbed with documented payload
// references; filling them in requires partner agreements + test devices,
// which the data plane is designed to absorb without re-architecting.
// ============================================================================

export type Vendor = "generic" | "garmin_inreach" | "iridiumgo" | "yb_tracking";

export const KNOWN_VENDORS: Vendor[] = [
  "generic",
  "garmin_inreach",
  "iridiumgo",
  "yb_tracking",
];

export interface NormalisedPosition {
  deviceId: string;
  reportedAt: Date;
  lat: number;
  lon: number;
  speedKn?: number;
  courseDeg?: number;
  batteryPct?: number;
  messageText?: string;
  rawPayload: unknown;
}

export interface AdapterContext {
  // Raw HTTP body — adapters that verify signatures need bytes, not the parsed
  // JSON (signature is computed over the exact bytes the vendor sent).
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
  webhookSecret: string;
  deviceId: string;
}

export interface VendorAdapter {
  vendor: Vendor;
  verify(ctx: AdapterContext): boolean;
  parse(ctx: AdapterContext): NormalisedPosition;
}

// ----------------------------------------------------------------------------
// Generic (Helmwise canonical shape)
// ----------------------------------------------------------------------------
// Expected payload:
//   {
//     "device_id": "abc123",
//     "reported_at": "2026-05-25T14:32:11Z",
//     "lat": 50.7587,
//     "lon": -1.2982,
//     "speed_kn": 5.4,
//     "course_deg": 132,
//     "battery_pct": 87,
//     "message_text": "All well, ETA 18:00"
//   }
//
// Signed via header `X-Helmwise-Signature: sha256=<hex>` where the hex is
// HMAC-SHA256(rawBody, webhook_secret). Timing-safe comparison.
// ----------------------------------------------------------------------------
const GenericAdapter: VendorAdapter = {
  vendor: "generic",
  verify(ctx) {
    const header = (ctx.headers["x-helmwise-signature"] ?? "") as string;
    const given = header.replace(/^sha256=/, "").trim();
    if (!given) return false;
    const expected = crypto
      .createHmac("sha256", ctx.webhookSecret)
      .update(ctx.rawBody)
      .digest("hex");
    return safeEquals(given, expected);
  },
  parse(ctx) {
    const body = JSON.parse(ctx.rawBody.toString("utf8")) as Record<
      string,
      unknown
    >;
    const lat = numOrThrow(body.lat, "lat");
    const lon = numOrThrow(body.lon, "lon");
    if (lat < -90 || lat > 90) throw new Error("lat out of range");
    if (lon < -180 || lon > 180) throw new Error("lon out of range");
    return {
      deviceId: ctx.deviceId,
      reportedAt: body.reported_at
        ? new Date(String(body.reported_at))
        : new Date(),
      lat,
      lon,
      speedKn: optNum(body.speed_kn),
      courseDeg: optNum(body.course_deg),
      batteryPct: optInt(body.battery_pct),
      messageText:
        typeof body.message_text === "string"
          ? body.message_text.slice(0, 1000)
          : undefined,
      rawPayload: body,
    };
  },
};

// ----------------------------------------------------------------------------
// Garmin InReach — STUB
// Reference: https://developer.garmin.com/inreach/
// Inbound API delivers messages + position via a Garmin-controlled webhook.
// Real production integration requires an inReach Inbound API contract.
// Payload shape: KML-like with <Placemark><ExtendedData> elements (XML, not
// JSON). When wiring this for real, replace `verify` with Garmin's IPC
// signature header and `parse` with an XML parser.
// ----------------------------------------------------------------------------
const GarminInReachAdapter: VendorAdapter = {
  vendor: "garmin_inreach",
  verify(_ctx) {
    // TODO(s2-vendor-adapters): implement Garmin IPC signature verification
    return false;
  },
  parse(_ctx) {
    throw new Error("garmin_inreach adapter not implemented");
  },
};

// ----------------------------------------------------------------------------
// IridiumGo — STUB
// Reference: Iridium CloudConnect / PredictWind tracking. There is no public
// self-service webhook; integrations are delivered via partner products.
// ----------------------------------------------------------------------------
const IridiumGoAdapter: VendorAdapter = {
  vendor: "iridiumgo",
  verify(_ctx) {
    // TODO(s2-vendor-adapters): wire IridiumGo partner webhook signature
    return false;
  },
  parse(_ctx) {
    throw new Error("iridiumgo adapter not implemented");
  },
};

// ----------------------------------------------------------------------------
// YB Tracking — STUB
// Reference: https://yb.tl/Help/API
// YB delivers position updates via a JSON webhook signed with an X-YB-Sign
// header. Most realistic of the three to implement next.
// ----------------------------------------------------------------------------
const YbTrackingAdapter: VendorAdapter = {
  vendor: "yb_tracking",
  verify(_ctx) {
    // TODO(s2-vendor-adapters): wire YB signature verification (sha1 over body)
    return false;
  },
  parse(_ctx) {
    throw new Error("yb_tracking adapter not implemented");
  },
};

const REGISTRY: Record<Vendor, VendorAdapter> = {
  generic: GenericAdapter,
  garmin_inreach: GarminInReachAdapter,
  iridiumgo: IridiumGoAdapter,
  yb_tracking: YbTrackingAdapter,
};

export function getAdapter(vendor: string): VendorAdapter | null {
  return (
    (REGISTRY as Record<string, VendorAdapter | undefined>)[vendor] ?? null
  );
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------
function safeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function numOrThrow(v: unknown, field: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
  return n;
}

function optNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optInt(v: unknown): number | undefined {
  const n = optNum(v);
  return n === undefined ? undefined : Math.round(n);
}

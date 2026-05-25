"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  MapPin,
  Plus,
  Radio,
  Satellite,
  Sparkles,
  Trash2,
} from "lucide-react";
import RequireAuth from "../../components/auth/RequireAuth";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EmptyState } from "../../components/ui/empty-state";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../components/ui/banner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { logger } from "../../lib/logger";

type Vendor = "generic" | "garmin_inreach" | "iridiumgo" | "yb_tracking";

interface Device {
  id: string;
  vendor: Vendor;
  device_id: string;
  nickname: string | null;
  deviation_state: "on" | "off" | null;
  last_report_at: string | null;
  created_at: string;
}

interface PositionRow {
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

interface CreatedDeviceResponse {
  device: Device & { webhook_secret: string };
  webhookUrl: string;
}

const VENDOR_LABELS: Record<Vendor, string> = {
  generic: "Generic (Helmwise format)",
  garmin_inreach: "Garmin InReach (coming soon)",
  iridiumgo: "IridiumGo (coming soon)",
  yb_tracking: "YB Tracking (coming soon)",
};

type TierState = "loading" | "free_or_premium" | "pro";

function DevicesContent() {
  const [tier, setTier] = useState<TierState>("loading");
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{
    vendor: Vendor;
    deviceId: string;
    nickname: string;
  }>({ vendor: "generic", deviceId: "", nickname: "" });
  const [created, setCreated] = useState<CreatedDeviceResponse | null>(null);
  const [positionsFor, setPositionsFor] = useState<Device | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setTier("free_or_premium");
          return;
        }
        const data = (await res.json()) as { subscription_tier?: string };
        if (cancelled) return;
        const t = data.subscription_tier ?? "free";
        setTier(t === "pro" || t === "enterprise" ? "pro" : "free_or_premium");
      } catch {
        if (!cancelled) setTier("free_or_premium");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sat-comm/devices", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) {
          setDevices([]);
          return;
        }
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as { devices: Device[] };
      setDevices(data.devices);
    } catch (error) {
      logger.error("Failed to load devices", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tier === "pro") refresh();
  }, [tier, refresh]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deviceId.trim()) {
      toast.error("Device ID is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/sat-comm/devices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: form.vendor,
          device_id: form.deviceId.trim(),
          nickname: form.nickname.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as CreatedDeviceResponse;
      setCreated(data);
      setShowForm(false);
      setForm({ vendor: "generic", deviceId: "", nickname: "" });
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add device",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (d: Device) => {
    if (
      !window.confirm(
        `Remove ${d.nickname ?? d.device_id}? Position history will be deleted.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/sat-comm/devices/${d.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Device removed");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete device",
      );
    }
  };

  const openPositions = async (d: Device) => {
    setPositionsFor(d);
    setPositionsLoading(true);
    try {
      const res = await fetch(`/api/sat-comm/devices/${d.id}/positions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as { positions: PositionRow[] };
      setPositions(data.positions);
    } catch (error) {
      logger.error("Failed to load positions", { error: String(error) });
      setPositions([]);
    } finally {
      setPositionsLoading(false);
    }
  };

  const purgePositions = async (d: Device) => {
    if (
      !window.confirm(
        "Delete ALL position history for this device? This cannot be undone.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/sat-comm/devices/${d.id}/positions`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Purge failed (${res.status})`);
      const data = (await res.json()) as { purged: number };
      toast.success(`Cleared ${data.purged} position reports`);
      setPositions([]);
    } catch (error) {
      toast.error("Failed to clear positions");
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — select the text manually");
    }
  };

  if (tier === "loading") {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </>
    );
  }

  if (tier === "free_or_premium") {
    return (
      <>
        <Header />
        <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Satellite className="h-8 w-8" />
                </div>
                <h1 className="font-display text-3xl">Sat-comm tracking</h1>
                <p className="text-muted-foreground">
                  Register satellite trackers (Garmin InReach, IridiumGo, YB
                  Tracker, or generic) so Helmwise can ingest position reports
                  and alert you if a vessel drifts off the planned route.
                </p>
                <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                  <p className="text-sm font-medium flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />A Pro feature
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sat-comm position reporting is part of the Pro tier, which
                    targets charter and delivery captains who depend on
                    continuous position monitoring.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Link href="/account">
                    <Button variant="outline">Back to account</Button>
                  </Link>
                  <Link href="/pricing">
                    <Button>Upgrade to Pro</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-2">Sat-comm devices</h1>
              <p className="text-muted-foreground">
                Register a satellite tracker so Helmwise can ingest position
                reports and alert you if a vessel drifts off the planned route.
              </p>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add device
              </Button>
            )}
          </div>

          <Banner variant="info">
            <BannerTitle>Position data is sensitive</BannerTitle>
            <BannerDescription>
              Helmwise retains the last 90 days of position reports per device.
              You can clear all data for a device at any time. Off-route alerts
              are sent to subscribers of the &quot;Safety alerts&quot; push
              topic.
            </BannerDescription>
          </Banner>

          {showForm && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-4">Add a device</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor">Vendor</Label>
                    <select
                      id="vendor"
                      value={form.vendor}
                      onChange={(e) =>
                        setForm({ ...form, vendor: e.target.value as Vendor })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {Object.entries(VENDOR_LABELS).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {form.vendor !== "generic" && (
                      <p className="text-xs text-muted-foreground">
                        This vendor adapter is in development. For now, register
                        as &quot;Generic&quot; and use any tracker that can POST
                        JSON.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="device_id">Device ID / IMEI</Label>
                    <Input
                      id="device_id"
                      value={form.deviceId}
                      onChange={(e) =>
                        setForm({ ...form, deviceId: e.target.value })
                      }
                      placeholder="e.g. 300434060000000"
                      maxLength={200}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nickname">Nickname (optional)</Label>
                    <Input
                      id="nickname"
                      value={form.nickname}
                      onChange={(e) =>
                        setForm({ ...form, nickname: e.target.value })
                      }
                      placeholder="Antares InReach"
                      maxLength={100}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? "Adding…" : "Add device"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Loading devices…
                </div>
              ) : devices.length === 0 ? (
                <EmptyState
                  icon={<Radio className="h-8 w-8" />}
                  title="No devices registered"
                  description="Register your first sat-comm device to start receiving position reports."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {devices.map((d) => (
                    <li key={d.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {d.nickname ?? d.device_id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {VENDOR_LABELS[d.vendor]} · {d.device_id}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {d.last_report_at
                              ? `Last report: ${new Date(d.last_report_at).toLocaleString()}`
                              : "No reports received yet"}
                            {d.deviation_state === "off" && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium">
                                Off-route
                              </span>
                            )}
                            {d.deviation_state === "on" && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-success/10 text-success px-2 py-0.5 text-xs font-medium">
                                On-route
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPositions(d)}
                            aria-label="View positions"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(d)}
                            aria-label="Delete device"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* "Created" dialog — shows webhook URL + secret exactly once */}
      <Dialog
        open={created !== null}
        onOpenChange={(open) => !open && setCreated(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Device registered</DialogTitle>
            <DialogDescription>
              Save the webhook secret now — it is shown only once. To rotate,
              delete the device and re-add it.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Webhook URL
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={created.webhookUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(created.webhookUrl, "URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Webhook secret (sign payloads with HMAC-SHA256)
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={created.device.webhook_secret}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(created.device.webhook_secret, "Secret")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Vendor must POST a JSON body and include{" "}
                <code>X-Helmwise-Signature: sha256=&lt;hex&gt;</code> where the
                hex is HMAC-SHA256 of the raw body keyed by the secret above.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>I&apos;ve saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Positions list */}
      <Dialog
        open={positionsFor !== null}
        onOpenChange={(open) => !open && setPositionsFor(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Positions —{" "}
              {positionsFor?.nickname ?? positionsFor?.device_id ?? ""}
            </DialogTitle>
            <DialogDescription>
              Last 100 reports. Position data is retained for 90 days.
            </DialogDescription>
          </DialogHeader>
          {positionsLoading ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              Loading…
            </p>
          ) : positions.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              No position reports yet.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground sticky top-0 bg-background">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Time (UTC)</th>
                    <th className="py-2 pr-3">Lat</th>
                    <th className="py-2 pr-3">Lon</th>
                    <th className="py-2 pr-3">kt</th>
                    <th className="py-2">Bat</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {new Date(p.reported_at)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 16)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {p.lat.toFixed(4)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {p.lon.toFixed(4)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {p.speed_kn !== null ? p.speed_kn.toFixed(1) : "—"}
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {p.battery_pct !== null ? `${p.battery_pct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter className="gap-2">
            {positionsFor && positions.length > 0 && (
              <Button
                variant="outline"
                onClick={() => purgePositions(positionsFor)}
              >
                <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                Clear all
              </Button>
            )}
            <Button onClick={() => setPositionsFor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DevicesPage() {
  return (
    <RequireAuth>
      <DevicesContent />
    </RequireAuth>
  );
}

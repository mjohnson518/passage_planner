"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, BellOff, Lock } from "lucide-react";
import RequireAuth from "../../components/auth/RequireAuth";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import {
  Banner,
  BannerTitle,
  BannerDescription,
} from "../../components/ui/banner";
import { useServiceWorker } from "../../hooks/useServiceWorker";
import { logger } from "../../lib/logger";

type Topic =
  | "safety_alerts"
  | "weather_updates"
  | "passage_reminders"
  | "maintenance"
  | "marketing";

interface TopicMeta {
  id: Topic;
  title: string;
  description: string;
  alwaysOn?: boolean;
}

// Order matters — safety_alerts at top to anchor the always-on row.
const TOPIC_META: TopicMeta[] = [
  {
    id: "safety_alerts",
    title: "Safety alerts",
    description:
      "Off-route, severe weather, and emergency signals. Always on — these may save lives.",
    alwaysOn: true,
  },
  {
    id: "weather_updates",
    title: "Weather updates",
    description:
      "When the forecast for a saved upcoming passage degrades materially (Phase R4 re-plan alerts).",
  },
  {
    id: "passage_reminders",
    title: "Passage reminders",
    description:
      "Float plan delivery confirmations and pre-departure checklist nudges.",
  },
  {
    id: "maintenance",
    title: "Maintenance reminders",
    description:
      "Service-interval alerts for engine, rigging, safety gear, and other items you track per vessel.",
  },
  {
    id: "marketing",
    title: "Product updates",
    description:
      "New features, beta invitations, and occasional newsletter. We keep it rare.",
  },
];

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface Subscription {
  endpoint: string;
  topics: Topic[];
}

interface Preferences {
  enabled: boolean;
  availableTopics: Topic[];
  subscriptions: Subscription[];
}

function NotificationsContent() {
  const {
    isSupported,
    subscribeToPush,
    unsubscribeFromPush,
    updatePushTopics,
  } = useServiceWorker();

  const [permission, setPermission] = useState<PermissionState>("default");
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Set<Topic>>(
    () =>
      new Set<Topic>(["safety_alerts", "weather_updates", "passage_reminders"]),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSupported || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, [isSupported]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/push/preferences", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 503) {
          setPrefs({ enabled: false, availableTopics: [], subscriptions: [] });
          return;
        }
        throw new Error(`Load failed (${res.status})`);
      }
      const data: Preferences = await res.json();
      setPrefs(data);
      if (data.subscriptions.length > 0) {
        // All subs share the same topics (updateUserTopics writes uniformly);
        // initial selection mirrors whichever row we got back first.
        setSelectedTopics(new Set<Topic>(data.subscriptions[0].topics));
      }
    } catch (error) {
      logger.error("Failed to load push preferences", {
        error: String(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribed = (prefs?.subscriptions.length ?? 0) > 0;

  const toggleTopic = (topic: Topic, next: boolean) => {
    const meta = TOPIC_META.find((t) => t.id === topic);
    if (meta?.alwaysOn) return;
    setSelectedTopics((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(topic);
      else copy.delete(topic);
      copy.add("safety_alerts");
      return copy;
    });
  };

  const handleEnable = async () => {
    setSaving(true);
    const ok = await subscribeToPush(Array.from(selectedTopics));
    if (ok) {
      setPermission("granted");
      await refresh();
    }
    setSaving(false);
  };

  const handleDisable = async () => {
    setSaving(true);
    await unsubscribeFromPush();
    await refresh();
    setSaving(false);
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    const ok = await updatePushTopics(Array.from(selectedTopics));
    if (ok) await refresh();
    setSaving(false);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="font-display text-4xl mb-2">Notifications</h1>
            <p className="text-muted-foreground">
              Choose how Helmwise reaches you when a saved passage&apos;s
              forecast changes, when crew share a float plan, or when
              there&apos;s a safety event you should know about.
            </p>
          </div>

          {permission === "unsupported" && (
            <Banner variant="warning">
              <BannerTitle>Push not supported</BannerTitle>
              <BannerDescription>
                This browser does not support Web Push notifications. Try the
                latest Chrome, Edge, Firefox, or Safari (16.4+ on iOS).
              </BannerDescription>
            </Banner>
          )}

          {permission === "denied" && (
            <Banner variant="warning">
              <BannerTitle>Notifications blocked</BannerTitle>
              <BannerDescription>
                You blocked notifications for this site. Re-enable them in your
                browser&apos;s site settings, then return here to subscribe.
              </BannerDescription>
            </Banner>
          )}

          {prefs && !prefs.enabled && (
            <Banner variant="destructive">
              <BannerTitle>Push service unavailable</BannerTitle>
              <BannerDescription>
                The server is missing VAPID configuration. Notifications cannot
                be delivered until an operator sets it up.
              </BannerDescription>
            </Banner>
          )}

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl mb-1">This device</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading
                      ? "Checking subscription status…"
                      : subscribed
                        ? `Subscribed on ${prefs?.subscriptions.length ?? 0} device${(prefs?.subscriptions.length ?? 0) === 1 ? "" : "s"}.`
                        : "Not subscribed on this device."}
                  </p>
                </div>
                {!loading &&
                  (subscribed ? (
                    <Button
                      variant="outline"
                      onClick={handleDisable}
                      disabled={saving}
                    >
                      <BellOff className="h-4 w-4 mr-2" />
                      Disable
                    </Button>
                  ) : (
                    <Button
                      onClick={handleEnable}
                      disabled={
                        saving ||
                        permission === "unsupported" ||
                        permission === "denied" ||
                        !(prefs?.enabled ?? true)
                      }
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      Enable on this device
                    </Button>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="font-display text-xl mb-1">
                  What we notify you about
                </h2>
                <p className="text-sm text-muted-foreground">
                  These preferences apply to every device you subscribe.
                </p>
              </div>

              <ul className="space-y-4">
                {TOPIC_META.map((topic) => {
                  const checked = selectedTopics.has(topic.id);
                  return (
                    <li
                      key={topic.id}
                      className="flex items-start justify-between gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{topic.title}</p>
                          {topic.alwaysOn && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" />
                              Always on
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {topic.description}
                        </p>
                      </div>
                      <Switch
                        checked={checked || !!topic.alwaysOn}
                        disabled={!!topic.alwaysOn || saving || !subscribed}
                        onCheckedChange={(next) =>
                          toggleTopic(topic.id, !!next)
                        }
                        aria-label={`Toggle ${topic.title}`}
                      />
                    </li>
                  );
                })}
              </ul>

              {subscribed && (
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSavePreferences} disabled={saving}>
                    {saving ? "Saving…" : "Save preferences"}
                  </Button>
                </div>
              )}

              {!subscribed && !loading && (
                <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Enable notifications on this device first, then choose which
                    topics you want to receive.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function AccountNotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}

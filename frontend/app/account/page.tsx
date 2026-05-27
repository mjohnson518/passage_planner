"use client";

import Link from "next/link";
import {
  Bell,
  BookOpen,
  Key,
  LifeBuoy,
  Radio,
  Settings,
  Ship,
  ShieldCheck,
  Users,
} from "lucide-react";
import RequireAuth from "../components/auth/RequireAuth";
import { Header } from "../components/layout/Header";
import { Card, CardContent } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";

// ============================================================================
// /account — coherent index of all account sub-pages.
//
// Many features shipped across the Premium/Pro roadmap live under /account/*.
// Without an index, users had to know the URLs to find them. This page lists
// every sub-page with a short description + icon so /account is the single
// entry point in the header dropdown.
// ============================================================================

interface AccountLink {
  href: string;
  title: string;
  description: string;
  Icon: typeof Settings;
  badge?: "Premium" | "Pro";
}

const LINKS: AccountLink[] = [
  {
    href: "/profile",
    title: "Profile",
    description: "Display name, contact info, and account preferences.",
    Icon: Settings,
  },
  {
    href: "/billing",
    title: "Billing",
    description: "Subscription, payment methods, top-up packs, and invoices.",
    Icon: ShieldCheck,
  },
  {
    href: "/account/notifications",
    title: "Notifications",
    description:
      "Push topic preferences (safety alerts, weather updates, maintenance reminders).",
    Icon: Bell,
  },
  {
    href: "/account/contacts",
    title: "Emergency contacts",
    description:
      "People who receive your float plan before each passage (max 5).",
    Icon: LifeBuoy,
    badge: "Premium",
  },
  {
    href: "/account/vessels",
    title: "Vessels & maintenance",
    description:
      "Track engine hours, watermaker hours, and service-interval items per vessel.",
    Icon: Ship,
    badge: "Premium",
  },
  {
    href: "/account/crew",
    title: "Crew certifications",
    description:
      "Track STCW, USCG, medical, first aid, passport and other crew certs.",
    Icon: Users,
    badge: "Pro",
  },
  {
    href: "/account/devices",
    title: "Sat-comm devices",
    description:
      "Register Garmin InReach / IridiumGo / YB / generic trackers for position reporting.",
    Icon: Radio,
    badge: "Pro",
  },
  {
    href: "/account/api-keys",
    title: "API keys",
    description:
      "Generate, scope, and revoke API keys for your own integrations.",
    Icon: Key,
    badge: "Pro",
  },
  {
    href: "/account/privacy",
    title: "Privacy & data",
    description:
      "Export your personal data or permanently delete your account.",
    Icon: ShieldCheck,
  },
];

const BADGE_CLASSES: Record<"Premium" | "Pro", string> = {
  Premium: "bg-primary/10 text-primary border-primary/30",
  Pro: "bg-purple-500/10 text-purple-700 border-purple-500/30",
};

function AccountIndexContent() {
  const { user } = useAuth();
  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <div>
            <h1 className="font-display text-4xl mb-2">Account</h1>
            <p className="text-muted-foreground">
              Signed in as{" "}
              <span className="font-mono text-foreground">{user?.email}</span>.
              Manage your profile, billing, and the per-feature data Helmwise
              keeps for your sailing.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="block group">
                <Card className="h-full hover:border-primary/40 transition-colors">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                        <link.Icon className="h-5 w-5" />
                      </div>
                      {link.badge && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[link.badge]}`}
                        >
                          {link.badge}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium group-hover:text-primary transition-colors">
                        {link.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {link.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Looking for the planner?
            </p>
            <p>
              Standalone tools (passage planner, anchor watch, anchorage notes,
              provisioning) are linked from the main navigation. This page is
              just for managing your account-scoped data.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AccountIndexPage() {
  return (
    <RequireAuth>
      <AccountIndexContent />
    </RequireAuth>
  );
}

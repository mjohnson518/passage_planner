"use client";

import Link from "next/link";
import { History, Plus, Ship, Waves } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { cn } from "../../lib/utils";

const QUICK_ACTIONS = [
  {
    href: "/planner",
    icon: Plus,
    title: "New Passage",
    description: "Plan a new route",
    accent: "primary",
  },
  {
    href: "/passages",
    icon: History,
    title: "My Passages",
    description: "View history",
    accent: "ocean",
  },
  {
    href: "/weather",
    icon: Waves,
    title: "Weather",
    description: "Check conditions",
    accent: "brass",
  },
  {
    href: "/fleet",
    icon: Ship,
    title: "My Boats",
    description: "Manage vessels",
    accent: "muted",
  },
] as const;

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {QUICK_ACTIONS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group"
          {...(item.href === "/planner"
            ? { "data-testid": "dashboard-new-passage" }
            : {})}
        >
          <Card className="h-full card-hover">
            <CardContent className="p-5 lg:p-6 text-center">
              <div
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 transition-all duration-300 group-hover:scale-110",
                  item.accent === "primary" &&
                    "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
                  item.accent === "ocean" &&
                    "bg-ocean-100 dark:bg-ocean-900/20 text-ocean-600 dark:text-ocean-400",
                  item.accent === "brass" &&
                    "bg-brass-100 dark:bg-brass-900/20 text-brass-600 dark:text-brass-400",
                  item.accent === "muted" && "bg-muted text-muted-foreground",
                )}
              >
                <item.icon className="h-7 w-7" />
              </div>
              <h3 className="font-display font-semibold text-base lg:text-lg">
                {item.title}
              </h3>
              <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                {item.description}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

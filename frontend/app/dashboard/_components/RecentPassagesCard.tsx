"use client";

import Link from "next/link";
import { ArrowRight, Compass, MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { EmptyState } from "../../components/ui/empty-state";
import { formatPassageDate } from "../../lib/format";
import { cn } from "../../lib/utils";

export interface RecentPassage {
  id: string;
  departure: string;
  destination: string;
  date: string;
  status: "completed" | "planned" | "in-progress";
  distance: number;
}

interface RecentPassagesCardProps {
  recentPassages: RecentPassage[];
}

export function RecentPassagesCard({
  recentPassages,
}: RecentPassagesCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-display text-xl">
            Recent Passages
          </CardTitle>
          <CardDescription>Your latest sailing plans</CardDescription>
        </div>
        <Link href="/passages">
          <Button variant="ghost" size="sm" className="text-primary">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recentPassages.length > 0 ? (
          <div className="space-y-3">
            {recentPassages.map((passage) => (
              <Link
                key={passage.id}
                href={`/passages/${passage.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {passage.departure} → {passage.destination}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground ml-10">
                    <span>{formatPassageDate(passage.date)}</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                    <span>{passage.distance} nm</span>
                  </div>
                </div>
                <Badge
                  variant={
                    passage.status === "completed"
                      ? "secondary"
                      : passage.status === "planned"
                        ? "outline"
                        : "default"
                  }
                  className={cn(
                    "ml-3 flex-shrink-0",
                    passage.status === "completed" && "badge-success",
                    passage.status === "planned" && "badge-primary",
                  )}
                >
                  {passage.status}
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Compass className="h-8 w-8" />}
            title="No passages yet"
            description="Plan your first passage to see it here — weather, tides, and a full safety analysis in under a minute."
            action={
              <Button asChild>
                <Link href="/planner">Plan Your First Passage</Link>
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

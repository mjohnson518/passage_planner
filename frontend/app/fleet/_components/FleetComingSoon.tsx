"use client";

import { Anchor } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

interface FleetComingSoonProps {
  onGoToPlanner: () => void;
}

export function FleetComingSoon({ onGoToPlanner }: FleetComingSoonProps) {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <Anchor className="h-16 w-16 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl">
              Fleet Management Coming Soon
            </CardTitle>
            <CardDescription>
              Multi-vessel coordination and crew management are on the way.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              We&apos;re building the fleet experience end-to-end before we ship
              it. In the meantime, you can plan passages for any individual
              vessel from the planner.
            </p>
            <Button size="lg" onClick={onGoToPlanner}>
              Go to Planner
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

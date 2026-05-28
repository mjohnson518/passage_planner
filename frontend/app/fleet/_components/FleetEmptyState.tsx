"use client";

import { Anchor, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

interface FleetEmptyStateProps {
  onCreateFleet: () => void;
}

export function FleetEmptyState({ onCreateFleet }: FleetEmptyStateProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <Anchor className="h-16 w-16 text-primary mx-auto mb-4" />
        <CardTitle className="text-2xl">Create Your Fleet</CardTitle>
        <CardDescription>
          Manage multiple vessels and coordinate with your crew
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground mb-6">
          Set up your fleet to track vessels, invite crew members, and share
          passage plans.
        </p>
        <Button size="lg" onClick={onCreateFleet}>
          <Plus className="mr-2 h-5 w-5" />
          Create Fleet
        </Button>
      </CardContent>
    </Card>
  );
}

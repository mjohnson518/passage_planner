"use client";

import { Settings, Share2 } from "lucide-react";
import { Button } from "../../components/ui/button";

interface FleetHeaderProps {
  name: string;
  description?: string;
  isAdmin: boolean;
  onShare: () => void;
}

export function FleetHeader({
  name,
  description,
  isAdmin,
  onShare,
}: FleetHeaderProps) {
  return (
    <div className="flex justify-between items-start mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display mb-2">
          {name}
        </h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share Passage
        </Button>
        {isAdmin && (
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        )}
      </div>
    </div>
  );
}

import { Anchor } from "lucide-react";

export function FleetLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Anchor className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
        <p className="text-muted-foreground">Loading fleet…</p>
      </div>
    </div>
  );
}

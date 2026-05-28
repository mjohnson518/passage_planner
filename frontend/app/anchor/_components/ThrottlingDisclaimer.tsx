import { Smartphone } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";

// Honest mobile-throttling disclaimer — explains the hard limits of running
// an anchor watch in a foregrounded mobile browser tab.
export function ThrottlingDisclaimer() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Smartphone className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-sm">
            <p className="font-medium">Keep this tab in the foreground.</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                Mobile browsers throttle (or suspend) JavaScript when the screen
                locks or you switch apps. Helmwise holds a screen Wake Lock
                where supported, but
                <strong> plug in</strong> and set Auto-Lock to{" "}
                <strong>Never</strong> (iOS Settings) for overnight watch.
              </li>
              <li>
                Vibrate is not supported on iOS Safari; audio alarm only on
                iPhone. Test volume before relying on it.
              </li>
              <li>
                <strong>This is decision support.</strong> Verify anchor holding
                by traditional means too (transit bearings, depth changes,
                anchor-buoy alignment).
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

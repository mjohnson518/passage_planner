"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { logger } from "../../lib/logger";

// Map will be implemented with Leaflet
// This is a placeholder component for now
interface InteractiveMapProps {
  passages?: any[];
  vessels?: any[];
  center?: [number, number];
  zoom?: number;
}

export default function InteractiveMap({
  passages = [],
  vessels = [],
  center = [0, 0],
  zoom = 2,
}: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet")
      .then((L) => {
        if (!mapRef.current) return;

        // Fix Leaflet icon paths
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "/leaflet/marker-icon-2x.png",
          iconUrl: "/leaflet/marker-icon.png",
          shadowUrl: "/leaflet/marker-shadow.png",
        });

        // Initialize map
        const map = L.map(mapRef.current).setView(center, zoom);

        // Add OpenStreetMap tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        // Add vessel markers if provided
        vessels.forEach((vessel) => {
          if (vessel.position) {
            L.marker([vessel.position.lat, vessel.position.lng])
              .bindPopup(`<strong>${vessel.name}</strong>`)
              .addTo(map);
          }
        });

        mapInstanceRef.current = map;

        return () => {
          map.remove();
          mapInstanceRef.current = null;
        };
      })
      .catch((error) => {
        logger.error("Failed to load Leaflet", { error: String(error) });
      });
  }, [center, zoom]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full bg-primary/5 rounded-lg"
      style={{ minHeight: "400px" }}
    />
  );
}

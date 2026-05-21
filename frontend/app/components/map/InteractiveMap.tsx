"use client";

import { useEffect, useRef } from "react";
import { logger } from "../../lib/logger";

/**
 * InteractiveMap — Leaflet-based world map with OpenStreetMap base tiles and
 * OpenSeaMap nautical overlay (buoys, harbours, seamarks). Renders vessel
 * markers and passage polylines if provided. Loaded dynamically to avoid
 * SSR breakage (Leaflet touches window/document at import time).
 */
interface InteractiveMapProps {
  passages?: Array<{
    id?: string;
    name?: string;
    waypoints: Array<{ latitude: number; longitude: number }>;
  }>;
  vessels?: Array<{
    name: string;
    position?: { lat: number; lng: number };
  }>;
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
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet")
      .then((L) => {
        if (!mapRef.current) return;

        // Fix Leaflet icon paths for the default marker. Without this the
        // marker images 404 on Next.js because the leaflet npm package
        // expects them at relative paths. The `as any` cast is needed
        // because Leaflet's typing of `Icon.Default.prototype` doesn't
        // surface `_getIconUrl` even though it's the documented escape.
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "/leaflet/marker-icon-2x.png",
          iconUrl: "/leaflet/marker-icon.png",
          shadowUrl: "/leaflet/marker-shadow.png",
        });

        const map = L.map(mapRef.current).setView(center, zoom);

        // Base map — OpenStreetMap.
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        // Nautical overlay — OpenSeaMap publishes IALA-style buoys, harbour
        // marks, depth notes, and seamark symbology globally. Layered on top
        // of OSM, it's the global equivalent of NOAA's ENC chart tiles.
        L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
          attribution: "© OpenSeaMap contributors",
          maxZoom: 18,
          opacity: 0.8,
        }).addTo(map);

        // Vessel markers
        vessels.forEach((vessel) => {
          if (vessel.position) {
            L.marker([vessel.position.lat, vessel.position.lng])
              .bindPopup(`<strong>${vessel.name}</strong>`)
              .addTo(map);
          }
        });

        // Passage polylines — draw each passage's waypoints as a route.
        passages.forEach((passage) => {
          if (passage.waypoints && passage.waypoints.length >= 2) {
            const latlngs = passage.waypoints.map(
              (w) => [w.latitude, w.longitude] as [number, number],
            );
            L.polyline(latlngs, {
              color: "#0c7c8a",
              weight: 3,
              opacity: 0.8,
            })
              .bindPopup(
                `<strong>${passage.name ?? "Passage"}</strong><br/>${latlngs.length} waypoints`,
              )
              .addTo(map);
          }
        });

        mapInstanceRef.current = map;
      })
      .catch((error) => {
        logger.error("Failed to load Leaflet", { error: String(error) });
      });

    return () => {
      const map = mapInstanceRef.current as { remove?: () => void } | null;
      if (map && typeof map.remove === "function") {
        map.remove();
      }
      mapInstanceRef.current = null;
    };
  }, [center, zoom, passages, vessels]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full bg-primary/5 rounded-lg"
      style={{ minHeight: "400px" }}
    />
  );
}

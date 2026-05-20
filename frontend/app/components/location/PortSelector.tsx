"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "../ui/input";
import { MapPin, Globe } from "lucide-react";
import { config } from "../../config";

interface Port {
  name: string;
  lat: number;
  lng: number;
  country?: string;
  source?: "local" | "geocode";
}

interface PortSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onPortSelected: (port: Port) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "data-testid"?: string;
}

/**
 * Fast-path list of well-known sailing destinations. These render
 * immediately as the user types so the common "Boston/Miami/Gibraltar"
 * paths feel instant. For anywhere else in the world we fall through to
 * `/api/geocode` which talks to Open-Meteo + Nominatim and returns
 * coordinates for arbitrary place names — that's how a sailor in Croatia
 * gets "Split" or one in Australia gets "Hobart" without us hardcoding
 * the full world atlas.
 */
const COMMON_PORTS: Port[] = [
  // US East Coast
  { name: "Boston, MA", lat: 42.3601, lng: -71.0589, country: "USA" },
  { name: "Portland, ME", lat: 43.6591, lng: -70.2568, country: "USA" },
  { name: "Newport, RI", lat: 41.4901, lng: -71.3128, country: "USA" },
  { name: "New York, NY", lat: 40.7128, lng: -74.006, country: "USA" },
  { name: "Charleston, SC", lat: 32.7765, lng: -79.9311, country: "USA" },
  { name: "Miami, FL", lat: 25.7617, lng: -80.1918, country: "USA" },
  { name: "Key West, FL", lat: 24.5551, lng: -81.78, country: "USA" },
  { name: "San Francisco, CA", lat: 37.7749, lng: -122.4194, country: "USA" },
  { name: "San Diego, CA", lat: 32.7157, lng: -117.1611, country: "USA" },
  { name: "Seattle, WA", lat: 47.6062, lng: -122.3321, country: "USA" },
  { name: "Honolulu, Hawaii", lat: 21.3099, lng: -157.8581, country: "USA" },
  // Caribbean
  { name: "Nassau, Bahamas", lat: 25.048, lng: -77.3554, country: "Bahamas" },
  {
    name: "Hamilton, Bermuda",
    lat: 32.2949,
    lng: -64.7829,
    country: "Bermuda",
  },
  {
    name: "Bridgetown, Barbados",
    lat: 13.0969,
    lng: -59.6145,
    country: "Barbados",
  },
  {
    name: "Rodney Bay, St. Lucia",
    lat: 14.0781,
    lng: -60.9542,
    country: "Saint Lucia",
  },
  {
    name: "English Harbour, Antigua",
    lat: 17.0051,
    lng: -61.7579,
    country: "Antigua",
  },
  // Mediterranean
  { name: "Gibraltar", lat: 36.1408, lng: -5.3536, country: "Gibraltar" },
  { name: "Barcelona, Spain", lat: 41.3851, lng: 2.1734, country: "Spain" },
  {
    name: "Palma de Mallorca, Spain",
    lat: 39.5696,
    lng: 2.6502,
    country: "Spain",
  },
  {
    name: "Athens (Piraeus), Greece",
    lat: 37.9422,
    lng: 23.647,
    country: "Greece",
  },
  { name: "Valletta, Malta", lat: 35.8989, lng: 14.5146, country: "Malta" },
  { name: "Marseille, France", lat: 43.2965, lng: 5.3698, country: "France" },
  { name: "Split, Croatia", lat: 43.5081, lng: 16.4402, country: "Croatia" },
  // UK & Northern Europe
  { name: "Cowes, Isle of Wight, UK", lat: 50.76, lng: -1.2925, country: "UK" },
  { name: "Plymouth, UK", lat: 50.3755, lng: -4.1427, country: "UK" },
  { name: "Kinsale, Ireland", lat: 51.7066, lng: -8.5183, country: "Ireland" },
  {
    name: "Amsterdam (IJmuiden), Netherlands",
    lat: 52.4647,
    lng: 4.5764,
    country: "Netherlands",
  },
  { name: "Kiel, Germany", lat: 54.3833, lng: 10.183, country: "Germany" },
  {
    name: "Copenhagen, Denmark",
    lat: 55.7203,
    lng: 12.5897,
    country: "Denmark",
  },
  // Pacific
  {
    name: "Papeete, Tahiti",
    lat: -17.535,
    lng: -149.5696,
    country: "French Polynesia",
  },
  { name: "Suva, Fiji", lat: -18.1416, lng: 178.4419, country: "Fiji" },
  // Asia
  { name: "Singapore", lat: 1.2644, lng: 103.822, country: "Singapore" },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694, country: "Hong Kong" },
  { name: "Phuket, Thailand", lat: 7.8804, lng: 98.3923, country: "Thailand" },
  // Atlantic Islands
  {
    name: "Las Palmas, Canary Islands",
    lat: 28.1391,
    lng: -15.4318,
    country: "Spain",
  },
  { name: "Horta, Azores", lat: 38.5319, lng: -28.6267, country: "Portugal" },
  {
    name: "Funchal, Madeira",
    lat: 32.6495,
    lng: -16.9083,
    country: "Portugal",
  },
  // Australia & NZ
  {
    name: "Sydney, Australia",
    lat: -33.8568,
    lng: 151.2153,
    country: "Australia",
  },
  {
    name: "Hobart, Tasmania",
    lat: -42.8902,
    lng: 147.35,
    country: "Australia",
  },
  {
    name: "Auckland, New Zealand",
    lat: -36.8485,
    lng: 174.7633,
    country: "New Zealand",
  },
  // South Africa & Canada
  {
    name: "Cape Town, South Africa",
    lat: -33.9089,
    lng: 18.4339,
    country: "South Africa",
  },
  {
    name: "Halifax, NS, Canada",
    lat: 44.6464,
    lng: -63.6017,
    country: "Canada",
  },
  {
    name: "Victoria, BC, Canada",
    lat: 48.4533,
    lng: -123.3014,
    country: "Canada",
  },
];

export default function PortSelector({
  value,
  onChange,
  onPortSelected,
  placeholder = "Type port name or any global location...",
  className = "",
  id,
  "data-testid": dataTestId,
}: PortSelectorProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredPorts, setFilteredPorts] = useState<Port[]>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const geocodeAbort = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep internal searchTerm in sync if the parent updates `value`
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Filter local list + (debounced) hit the global geocode endpoint.
  // The local list shows instantly. Geocode results stream in 300ms after
  // the user pauses typing and are merged with local results.
  useEffect(() => {
    if (searchTerm.length === 0) {
      setFilteredPorts([]);
      setShowDropdown(false);
      return;
    }

    const q = searchTerm.toLowerCase();
    const local = COMMON_PORTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.country && p.country.toLowerCase().includes(q)),
    )
      .slice(0, 5)
      .map((p) => ({ ...p, source: "local" as const }));

    setFilteredPorts(local);
    setShowDropdown(true);

    // Cancel any pending geocode call before starting a new one.
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (geocodeAbort.current) geocodeAbort.current.abort();

    // Don't bother the geocoder for trivially-short queries.
    if (searchTerm.length < 3) return;

    debounceTimer.current = setTimeout(async () => {
      const abort = new AbortController();
      geocodeAbort.current = abort;
      setGeocodeLoading(true);
      try {
        const res = await fetch(
          `${config.api.url}/api/geocode?q=${encodeURIComponent(searchTerm)}&limit=6`,
          { signal: abort.signal, credentials: "include" },
        );
        if (!res.ok) return;
        const data: {
          results: Array<{
            name: string;
            latitude: number;
            longitude: number;
            country?: string;
          }>;
        } = await res.json();

        const geocoded: Port[] = (data.results || []).map((r) => ({
          name: r.name,
          lat: r.latitude,
          lng: r.longitude,
          country: r.country,
          source: "geocode",
        }));

        // De-dupe by ~10km coordinate proximity, prefer local matches first.
        const combined: Port[] = [...local];
        for (const g of geocoded) {
          const dup = combined.some(
            (c) =>
              Math.abs(c.lat - g.lat) < 0.1 && Math.abs(c.lng - g.lng) < 0.1,
          );
          if (!dup) combined.push(g);
          if (combined.length >= 10) break;
        }

        setFilteredPorts(combined);
        setShowDropdown(combined.length > 0);
      } catch (err) {
        // AbortError on rapid typing is expected; swallow silently.
        if ((err as { name?: string }).name !== "AbortError") {
          // eslint-disable-next-line no-console
          console.warn("Geocode lookup failed", err);
        }
      } finally {
        setGeocodeLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPort = (port: Port) => {
    setSearchTerm(port.name);
    onChange(port.name);
    onPortSelected(port);
    setShowDropdown(false);
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      data-testid={dataTestId || (id ? `port-selector-${id}` : "port-selector")}
    >
      <Input
        type="text"
        data-testid={id ? `port-selector-${id}-input` : "port-selector-input"}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => searchTerm.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={className}
        id={id}
        autoComplete="off"
      />

      {showDropdown && filteredPorts.length > 0 && (
        <div
          data-testid="port-selector-dropdown"
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-maritime max-h-72 overflow-auto"
        >
          {filteredPorts.map((port, index) => (
            <div
              key={`${port.name}-${index}`}
              className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between"
              onClick={() => handleSelectPort(port)}
            >
              <div>
                <div className="font-medium text-sm text-popover-foreground">
                  {port.name}
                </div>
                {port.country && (
                  <div className="text-xs text-muted-foreground">
                    {port.country}
                  </div>
                )}
              </div>
              {port.source === "geocode" ? (
                <Globe className="h-4 w-4 text-muted-foreground" />
              ) : (
                <MapPin className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
          {geocodeLoading && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              Searching globally…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export function AddAnchorageForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    lat: "",
    lon: "",
    country: "",
    region: "",
    description: "",
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.lat || !form.lon) {
      toast.error("Name, latitude, and longitude are required");
      return;
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      lat: Number(form.lat),
      lon: Number(form.lon),
    };
    if (form.country.trim()) payload.country = form.country.trim();
    if (form.region.trim()) payload.region = form.region.trim();
    if (form.description.trim()) payload.description = form.description.trim();
    try {
      const res = await fetch("/api/anchorages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as { anchorage: { name: string } };
      toast.success(`Added "${data.anchorage.name}"`);
      setForm({
        name: "",
        lat: "",
        lon: "",
        country: "",
        region: "",
        description: "",
      });
      onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add anchorage",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(5),
          lon: pos.coords.longitude.toFixed(5),
        }));
        toast.success("Coordinates filled");
      },
      () => toast.error("Could not get your position"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl mb-4">Add an anchorage</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Cala Tuent"
              required
              maxLength={200}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lat">Latitude *</Label>
              <Input
                id="lat"
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lon">Longitude *</Label>
              <Input
                id="lon"
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={form.lon}
                onChange={(e) => setForm({ ...form, lon: e.target.value })}
                required
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUseCurrentLocation}
          >
            <Compass className="h-4 w-4 mr-2" />
            Use my current location
          </Button>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="Spain"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="Mallorca"
                maxLength={100}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              aria-label="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              maxLength={4000}
              placeholder="Quiet bay on Mallorca's north coast. Sand bottom with patches of weed."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            You can refine holding / shelter / depth fields on the detail page
            after creating the entry. Other cruisers contribute notes; only you
            can edit the structured fields you set here.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add anchorage"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

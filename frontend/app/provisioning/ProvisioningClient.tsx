"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Square,
  Printer,
  Utensils,
  Droplets,
  Pill,
  Sparkles,
  RotateCw,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../components/ui/banner";
import { cn } from "../lib/utils";

// ============================================================================
// /provisioning — provisioning calculator (free for all tiers)
//
// Pure client-side math. Given (crew, days, climate, activity), produces a
// categorised checklist with quantities the captain can print and take to
// the chandlery. "Mark as packed" state persists in localStorage so the
// page is useful as a multi-session shopping list.
//
// Numbers are derived from sailing-school cruising-prep references
// (RYA / USSA / Pardey) cross-checked against the Helmwise safety mantra
// of 30% reserve buffer. They're starting points — the disclaimer at the
// bottom says so explicitly.
// ============================================================================

const STORAGE_KEY = "helmwise.provisioning.v1";

type Climate = "temperate" | "tropical" | "cold";
type Activity = "light" | "active" | "heavy_weather";

interface Inputs {
  crew: number;
  days: number;
  climate: Climate;
  activity: Activity;
  hasFridge: boolean;
}

const DEFAULT_INPUTS: Inputs = {
  crew: 2,
  days: 3,
  climate: "temperate",
  activity: "active",
  hasFridge: true,
};

// ----------------------------------------------------------------------------
// Math — all per-person-per-day baselines
// ----------------------------------------------------------------------------

// Water (litres) — drinking + cooking + minimum hygiene. Tropical climate
// roughly doubles drinking; cold climate slightly increases cooking (hot
// meals). All multiplied by 1.3 reserve buffer matching Helmwise safety
// doctrine.
const WATER_RESERVE_MULTIPLIER = 1.3;
function waterLitresPerPersonPerDay(climate: Climate): {
  drinking: number;
  cooking: number;
  hygiene: number;
} {
  switch (climate) {
    case "tropical":
      return { drinking: 4, cooking: 1.5, hygiene: 6 };
    case "cold":
      return { drinking: 2, cooking: 2, hygiene: 4 };
    case "temperate":
    default:
      return { drinking: 2.5, cooking: 1.5, hygiene: 5 };
  }
}

// Calories per person per day — sedentary baseline is ~2000 for adults;
// active sailing watch-keeping bumps it; heavy weather (cold, wet, hard
// physical work) bumps it further.
function caloriesPerPersonPerDay(activity: Activity): number {
  switch (activity) {
    case "light":
      return 2200;
    case "heavy_weather":
      return 3500;
    case "active":
    default:
      return 3000;
  }
}

// Perishable window — without refrigeration, plan for 1 day of fresh
// produce. With fridge, ~5 days before reliance on canned/dried.
const PERISHABLE_DAYS_WITH_FRIDGE = 5;
const PERISHABLE_DAYS_WITHOUT_FRIDGE = 1;

// ----------------------------------------------------------------------------
// Checklist generation
// ----------------------------------------------------------------------------

interface ChecklistItem {
  id: string;
  category: "water" | "food" | "galley" | "medical";
  label: string;
  quantity: string;
  note?: string;
}

function buildChecklist(input: Inputs): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const personDays = input.crew * input.days;
  const water = waterLitresPerPersonPerDay(input.climate);
  const totalDrinkingL = water.drinking * personDays * WATER_RESERVE_MULTIPLIER;
  const totalCookingL = water.cooking * personDays * WATER_RESERVE_MULTIPLIER;
  const totalHygieneL = water.hygiene * personDays * WATER_RESERVE_MULTIPLIER;

  items.push({
    id: "water-drinking",
    category: "water",
    label: "Drinking water",
    quantity: `${totalDrinkingL.toFixed(1)} L`,
    note: `${water.drinking} L/p/d × ${personDays} person-days + 30% reserve`,
  });
  items.push({
    id: "water-cooking",
    category: "water",
    label: "Cooking water",
    quantity: `${totalCookingL.toFixed(1)} L`,
    note: "Pasta, rice, soup, coffee/tea",
  });
  items.push({
    id: "water-hygiene",
    category: "water",
    label: "Hygiene / dishes",
    quantity: `${totalHygieneL.toFixed(1)} L`,
    note: "Sponge baths, dish rinse, tooth-brush water",
  });

  const totalCalories = caloriesPerPersonPerDay(input.activity) * personDays;
  const perishableDays = input.hasFridge
    ? PERISHABLE_DAYS_WITH_FRIDGE
    : PERISHABLE_DAYS_WITHOUT_FRIDGE;
  const perishableDaysActual = Math.min(perishableDays, input.days);
  const shelfStableDays = Math.max(0, input.days - perishableDaysActual);
  const perishableCal =
    caloriesPerPersonPerDay(input.activity) * input.crew * perishableDaysActual;
  const shelfStableCal =
    caloriesPerPersonPerDay(input.activity) * input.crew * shelfStableDays;

  items.push({
    id: "food-total",
    category: "food",
    label: "Total calorie target",
    quantity: `${totalCalories.toLocaleString()} kcal`,
    note: `${caloriesPerPersonPerDay(input.activity)} kcal/p/d × ${personDays} person-days`,
  });
  if (perishableDaysActual > 0) {
    items.push({
      id: "food-perishable",
      category: "food",
      label: `Fresh / perishable (first ${perishableDaysActual} day${perishableDaysActual === 1 ? "" : "s"})`,
      quantity: `${perishableCal.toLocaleString()} kcal`,
      note: input.hasFridge
        ? "Eggs, dairy, meat, leafy greens, fruit"
        : "Hard cheese, hard salami, root veg, citrus — no refrigeration",
    });
  }
  if (shelfStableDays > 0) {
    items.push({
      id: "food-shelf-stable",
      category: "food",
      label: `Shelf-stable (remaining ${shelfStableDays} day${shelfStableDays === 1 ? "" : "s"})`,
      quantity: `${shelfStableCal.toLocaleString()} kcal`,
      note: "Canned beans/tuna/soup, pasta, rice, oatmeal, peanut butter, jerky, crackers, UHT milk",
    });
  }
  items.push({
    id: "food-snacks",
    category: "food",
    label: "Watch-keeping snacks",
    quantity: `~${Math.ceil(personDays / 2)} bags`,
    note: "High-cal, hand-held, no prep: trail mix, granola bars, dried fruit, chocolate",
  });

  // Galley supplies — fixed per-crew-day or per-trip
  items.push({
    id: "galley-propane",
    category: "galley",
    label: "Propane",
    quantity: `${Math.ceil(input.days / 7)} × 1lb bottle (or ~${(input.days * 0.05).toFixed(2)} kg)`,
    note: "Assumes ~30 min cooking/day on a 2-burner stove",
  });
  items.push({
    id: "galley-paper-towels",
    category: "galley",
    label: "Paper towels",
    quantity: `${Math.max(1, Math.ceil(input.days / 4))} rolls`,
  });
  items.push({
    id: "galley-foil-bags",
    category: "galley",
    label: "Foil + zip-bags",
    quantity: "1 roll + 1 box assorted",
    note: "Leftovers, sea-going storage",
  });
  items.push({
    id: "galley-dish-soap",
    category: "galley",
    label: "Biodegradable dish soap",
    quantity: input.days <= 3 ? "Small bottle" : "Standard bottle",
    note: "Biodegradable matters for marine grey-water",
  });
  items.push({
    id: "galley-trash-bags",
    category: "galley",
    label: "Trash bags",
    quantity: `${Math.max(3, Math.ceil(personDays / 2))} bags`,
    note: "Plan to carry trash off — no overboard disposal",
  });

  // Medical / first aid — basics every passage should have
  items.push({
    id: "medical-first-aid",
    category: "medical",
    label: "First-aid kit",
    quantity: "1 fully-stocked",
    note: "Check expiry on bandages, antiseptic, gauze — replenish as needed",
  });
  items.push({
    id: "medical-seasickness",
    category: "medical",
    label: "Anti-seasickness medication",
    quantity: `${input.crew * Math.max(2, Math.ceil(input.days / 2))} doses`,
    note: "Bonine / Stugeron / scopolamine patches — bring options",
  });
  items.push({
    id: "medical-sunscreen",
    category: "medical",
    label: "Sunscreen (SPF 30+, reef-safe)",
    quantity:
      input.climate === "tropical"
        ? `${Math.ceil(input.crew / 2)} bottles`
        : "1 bottle",
    note: "Tropical UV is brutal even with hat + shirt",
  });
  items.push({
    id: "medical-pain",
    category: "medical",
    label: "Painkillers (ibuprofen + paracetamol)",
    quantity: "Standard bottle of each",
  });
  items.push({
    id: "medical-prescriptions",
    category: "medical",
    label: "Crew prescriptions",
    quantity: "Per crew + 50% buffer",
    note: "Confirm each crew member has their meds + spare supply for delays",
  });
  items.push({
    id: "medical-electrolytes",
    category: "medical",
    label: "Electrolyte rehydration sachets",
    quantity: `${input.crew * Math.ceil(input.days / 3)} sachets`,
    note: "Heat exhaustion, post-seasickness rehydration",
  });

  return items;
}

const CATEGORY_META: Record<
  ChecklistItem["category"],
  { label: string; Icon: typeof Droplets; classes: string }
> = {
  water: {
    label: "Water",
    Icon: Droplets,
    classes: "text-blue-600 bg-blue-500/10 border-blue-500/30",
  },
  food: {
    label: "Food",
    Icon: Utensils,
    classes: "text-amber-700 bg-amber-500/10 border-amber-500/30",
  },
  galley: {
    label: "Galley",
    Icon: Sparkles,
    classes: "text-teal-700 bg-teal-500/10 border-teal-500/30",
  },
  medical: {
    label: "Medical",
    Icon: Pill,
    classes: "text-destructive bg-destructive/10 border-destructive/30",
  },
};

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------

function readStoredState(): { inputs?: Inputs; packedIds?: string[] } {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as { inputs?: Inputs; packedIds?: string[] };
  } catch {
    // localStorage shape mismatch — ignore and start fresh
    return {};
  }
}

export default function ProvisioningClient() {
  const [inputs, setInputs] = useState<Inputs>(() => {
    const parsed = readStoredState();
    return parsed.inputs
      ? { ...DEFAULT_INPUTS, ...parsed.inputs }
      : DEFAULT_INPUTS;
  });
  const [packedIds, setPackedIds] = useState<Set<string>>(() => {
    const parsed = readStoredState();
    return Array.isArray(parsed.packedIds)
      ? new Set(parsed.packedIds)
      : new Set();
  });

  // Persist on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ inputs, packedIds: Array.from(packedIds) }),
      );
    } catch {
      // quota — non-fatal
    }
  }, [inputs, packedIds]);

  const checklist = useMemo(() => buildChecklist(inputs), [inputs]);

  const togglePacked = (id: string) => {
    setPackedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReset = () => {
    if (
      !window.confirm(
        "Reset all 'packed' checkboxes? Your inputs will be kept.",
      )
    )
      return;
    setPackedIds(new Set());
  };

  const handlePrint = () => {
    window.print();
  };

  const grouped = useMemo(() => {
    const byCategory = new Map<ChecklistItem["category"], ChecklistItem[]>();
    for (const item of checklist) {
      const bucket = byCategory.get(item.category) ?? [];
      bucket.push(item);
      byCategory.set(item.category, bucket);
    }
    return Array.from(byCategory.entries());
  }, [checklist]);

  return (
    <>
      <div className="print:hidden">
        <Header />
      </div>
      <div className="min-h-screen px-4 py-8 sm:py-12 sm:px-6 lg:px-8 print:p-0">
        <div className="mx-auto max-w-3xl space-y-6 print:max-w-full">
          <div className="print:hidden">
            <h1 className="font-display text-4xl mb-2">Provisioning</h1>
            <p className="text-muted-foreground">
              Calculate water / food / galley / medical quantities for a
              passage. Numbers are starting points sized with Helmwise&apos;s
              30% reserve mantra. Mark items as packed; the page remembers.
            </p>
          </div>

          {/* Inputs */}
          <Card className="print:hidden">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-display text-xl">Inputs</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crew">Crew size</Label>
                  <Input
                    id="crew"
                    type="number"
                    min="1"
                    max="20"
                    value={inputs.crew}
                    onChange={(e) =>
                      setInputs({
                        ...inputs,
                        crew: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days">Days at sea</Label>
                  <Input
                    id="days"
                    type="number"
                    min="1"
                    max="60"
                    value={inputs.days}
                    onChange={(e) =>
                      setInputs({
                        ...inputs,
                        days: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="climate">Climate</Label>
                  <select
                    id="climate"
                    value={inputs.climate}
                    onChange={(e) =>
                      setInputs({
                        ...inputs,
                        climate: e.target.value as Climate,
                      })
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="cold">Cold (sub-15°C average)</option>
                    <option value="temperate">Temperate</option>
                    <option value="tropical">Tropical (30°C+)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity">Activity level</Label>
                  <select
                    id="activity"
                    value={inputs.activity}
                    onChange={(e) =>
                      setInputs({
                        ...inputs,
                        activity: e.target.value as Activity,
                      })
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="light">Light (day-sailing / anchor)</option>
                    <option value="active">
                      Active (offshore watch-keeping)
                    </option>
                    <option value="heavy_weather">
                      Heavy weather (cold + wet + physical)
                    </option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm pt-2">
                <input
                  type="checkbox"
                  checked={inputs.hasFridge}
                  onChange={(e) =>
                    setInputs({ ...inputs, hasFridge: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  Vessel has refrigeration (extends perishable window from 1 day
                  → 5 days)
                </span>
              </label>
            </CardContent>
          </Card>

          {/* Print + reset actions */}
          <div className="flex items-center justify-between gap-2 print:hidden">
            <p className="text-sm text-muted-foreground">
              <strong>{checklist.length}</strong> items ·{" "}
              <strong>{packedIds.size}</strong> packed
            </p>
            <div className="flex gap-2">
              {packedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCw className="h-4 w-4 mr-2" />
                  Reset packed
                </Button>
              )}
              <Button size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print list
              </Button>
            </div>
          </div>

          {/* Print-only header */}
          <div className="hidden print:block">
            <h1 className="font-display text-2xl">
              Provisioning · {inputs.crew} crew × {inputs.days} days ·{" "}
              {inputs.climate} · {inputs.activity.replace("_", " ")}
            </h1>
            <p className="text-xs mt-1" suppressHydrationWarning>
              Generated by Helmwise · {new Date().toLocaleDateString()}
            </p>
          </div>

          {/* Checklist */}
          <div className="space-y-4">
            {grouped.map(([category, items]) => {
              const meta = CATEGORY_META[category];
              return (
                <Card key={category}>
                  <CardContent className="p-0">
                    <div
                      className={cn(
                        "px-5 py-3 border-b border-border flex items-center gap-2",
                        "print:border-b print:border-black",
                      )}
                    >
                      <meta.Icon className="h-4 w-4" />
                      <h2 className="font-display text-lg">{meta.label}</h2>
                    </div>
                    <ul className="divide-y divide-border print:divide-black/20">
                      {items.map((item) => {
                        const packed = packedIds.has(item.id);
                        return (
                          <li key={item.id} className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => togglePacked(item.id)}
                              className={cn(
                                "w-full flex items-start gap-3 text-left",
                                "print:cursor-default",
                              )}
                            >
                              {packed ? (
                                <CheckSquare className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                  <p
                                    className={cn(
                                      "font-medium text-sm",
                                      packed &&
                                        "line-through text-muted-foreground",
                                    )}
                                  >
                                    {item.label}
                                  </p>
                                  <p className="text-sm font-mono tabular-nums">
                                    {item.quantity}
                                  </p>
                                </div>
                                {item.note && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {item.note}
                                  </p>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Honest disclaimer */}
          <Banner variant="info" className="print:hidden">
            <BannerTitle>Starting points, not gospel</BannerTitle>
            <BannerDescription>
              Quantities are sized for typical adult crew using cruising-school
              references (RYA / USSA / Pardey) with Helmwise&apos;s 30% reserve
              buffer. Adjust for known appetites, dietary restrictions, medical
              conditions, and stated rendezvous opportunities along the route.
              The captain is responsible for final provisioning.
            </BannerDescription>
          </Banner>
        </div>
      </div>
    </>
  );
}

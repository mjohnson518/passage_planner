interface PreDepartureChecklistProps {
  checklist: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
}

const CHECKLIST_ITEMS = [
  {
    id: "weather",
    label: "Check latest weather forecast & marine warnings",
  },
  {
    id: "tides",
    label: "Verify tidal heights for departure and arrival",
  },
  {
    id: "floatplan",
    label: "File float plan with shore contact",
  },
  {
    id: "safety",
    label: "Check safety equipment (PFDs, flares, fire extinguisher)",
  },
  {
    id: "nav",
    label: "Review charts and update navigation equipment",
  },
  { id: "fuel", label: "Verify fuel and water levels" },
  {
    id: "engine",
    label: "Engine check (oil, coolant, belts)",
  },
  {
    id: "vhf",
    label: "Test VHF radio - confirm Channel 16 reception",
  },
  {
    id: "crew",
    label: "Crew briefing: route, watch schedule, MOB procedures",
  },
  { id: "epirb", label: "EPIRB/PLB registered and charged" },
];

export function PreDepartureChecklist({
  checklist,
  onToggle,
}: PreDepartureChecklistProps) {
  return (
    <div>
      <p className="font-semibold text-sm mb-3">Pre-Departure Checklist</p>
      <div className="space-y-2">
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.id}
            className="flex items-start gap-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={checklist?.[item.id] || false}
              onChange={(e) => onToggle(item.id, e.target.checked)}
              className="mt-1 rounded border-input"
            />
            <span className="text-sm">{item.label}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        {Object.values(checklist || {}).filter(Boolean).length}/10 items
        completed
      </div>
    </div>
  );
}

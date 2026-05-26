import {
  evaluateOverdue,
  MAINTENANCE_DUE_SOON_FRACTION,
  type MaintenanceItemRow,
  type VesselRow,
} from "../MaintenanceMonitor";

const NOW = new Date("2026-05-26T12:00:00Z");
const HOURS = (n: number) => n * 60 * 60 * 1000;

function makeVessel(over: Partial<VesselRow> = {}): VesselRow {
  return {
    id: "v1",
    user_id: "u1",
    name: "Antares",
    current_engine_hours: 100,
    current_watermaker_hours: 50,
    ...over,
  };
}

function makeItem(over: Partial<MaintenanceItemRow> = {}): MaintenanceItemRow {
  return {
    id: "m1",
    user_id: "u1",
    vessel_id: "v1",
    item: "Engine oil change",
    category: "engine",
    interval_hours: null,
    interval_days: null,
    hours_meter_source: null,
    last_serviced_at: null,
    last_serviced_at_hours: null,
    last_alerted_at: null,
    ...over,
  };
}

describe("evaluateOverdue", () => {
  describe("never serviced", () => {
    it("returns overdue with baseline reason", () => {
      const r = evaluateOverdue(
        makeItem({ interval_days: 365 }),
        makeVessel(),
        NOW,
      );
      expect(r.status).toBe("overdue");
      expect(r.reason).toMatch(/baseline/i);
    });
  });

  describe("time-based interval only", () => {
    it("OK when within interval", () => {
      // Serviced 100 days ago, interval 365 days → 265 days remaining
      const lastServiced = new Date(NOW.getTime() - 100 * 24 * HOURS(1));
      const r = evaluateOverdue(
        makeItem({
          interval_days: 365,
          last_serviced_at: lastServiced.toISOString(),
        }),
        makeVessel(),
        NOW,
      );
      expect(r.status).toBe("ok");
      expect(r.daysUntilDue).toBeCloseTo(265, 0);
    });

    it("due_soon within 20% of interval", () => {
      // Serviced 320 days ago, interval 365 days → 45 days remaining = 12% → due_soon
      const lastServiced = new Date(NOW.getTime() - 320 * 24 * HOURS(1));
      const r = evaluateOverdue(
        makeItem({
          interval_days: 365,
          last_serviced_at: lastServiced.toISOString(),
        }),
        makeVessel(),
        NOW,
      );
      expect(r.status).toBe("due_soon");
    });

    it("overdue when past interval", () => {
      const lastServiced = new Date(NOW.getTime() - 400 * 24 * HOURS(1));
      const r = evaluateOverdue(
        makeItem({
          interval_days: 365,
          last_serviced_at: lastServiced.toISOString(),
        }),
        makeVessel(),
        NOW,
      );
      expect(r.status).toBe("overdue");
      expect(r.reason).toMatch(/days overdue/);
    });
  });

  describe("hours-based interval only", () => {
    it("OK when meter has not advanced past interval", () => {
      // Serviced at 50 engine hours; now at 100; interval 100 → 50 remaining
      const r = evaluateOverdue(
        makeItem({
          interval_hours: 100,
          hours_meter_source: "engine",
          last_serviced_at: new Date(
            NOW.getTime() - 10 * 24 * HOURS(1),
          ).toISOString(),
          last_serviced_at_hours: 50,
        }),
        makeVessel({ current_engine_hours: 100 }),
        NOW,
      );
      expect(r.status).toBe("ok");
      expect(r.hoursUntilDue).toBe(50);
    });

    it("overdue when meter has run past interval", () => {
      // Serviced at 50 engine hours; now at 200; interval 100 → 50h overdue
      const r = evaluateOverdue(
        makeItem({
          interval_hours: 100,
          hours_meter_source: "engine",
          last_serviced_at: new Date(
            NOW.getTime() - 30 * 24 * HOURS(1),
          ).toISOString(),
          last_serviced_at_hours: 50,
        }),
        makeVessel({ current_engine_hours: 200 }),
        NOW,
      );
      expect(r.status).toBe("overdue");
      expect(r.reason).toMatch(/h overdue/);
    });

    it("uses watermaker meter when source is watermaker", () => {
      const r = evaluateOverdue(
        makeItem({
          item: "Replace membrane",
          interval_hours: 200,
          hours_meter_source: "watermaker",
          last_serviced_at: new Date(
            NOW.getTime() - 30 * 24 * HOURS(1),
          ).toISOString(),
          last_serviced_at_hours: 0,
        }),
        makeVessel({ current_watermaker_hours: 250 }),
        NOW,
      );
      expect(r.status).toBe("overdue");
      expect(r.reason).toMatch(/watermaker/);
    });
  });

  describe("both intervals set — earlier wins", () => {
    it("triggers on hours when hours pass first", () => {
      const lastServiced = new Date(NOW.getTime() - 30 * 24 * HOURS(1));
      const r = evaluateOverdue(
        makeItem({
          interval_hours: 100,
          interval_days: 365,
          hours_meter_source: "engine",
          last_serviced_at: lastServiced.toISOString(),
          last_serviced_at_hours: 50,
        }),
        makeVessel({ current_engine_hours: 200 }), // 150 hours used > 100
        NOW,
      );
      expect(r.status).toBe("overdue");
      expect(r.reason).toMatch(/h overdue/);
    });

    it("triggers on days when days pass first", () => {
      const lastServiced = new Date(NOW.getTime() - 400 * 24 * HOURS(1));
      const r = evaluateOverdue(
        makeItem({
          interval_hours: 100,
          interval_days: 365,
          hours_meter_source: "engine",
          last_serviced_at: lastServiced.toISOString(),
          last_serviced_at_hours: 80,
        }),
        makeVessel({ current_engine_hours: 100 }), // 20 hours used < 100
        NOW,
      );
      expect(r.status).toBe("overdue");
      expect(r.reason).toMatch(/days overdue/);
    });

    it("OK when both within interval and outside due_soon window", () => {
      const lastServiced = new Date(NOW.getTime() - 30 * 24 * HOURS(1));
      const r = evaluateOverdue(
        makeItem({
          interval_hours: 100,
          interval_days: 365,
          hours_meter_source: "engine",
          last_serviced_at: lastServiced.toISOString(),
          last_serviced_at_hours: 50,
        }),
        makeVessel({ current_engine_hours: 100 }),
        NOW,
      );
      expect(r.status).toBe("ok");
    });
  });

  describe("constants", () => {
    it("due_soon fraction is 0.2 (20%)", () => {
      expect(MAINTENANCE_DUE_SOON_FRACTION).toBe(0.2);
    });
  });
});

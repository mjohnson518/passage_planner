import {
  ALERT_SCORE_DROP,
  isEligible,
  shouldAlert,
  SCAN_LOOKAHEAD_HOURS,
  ALERT_DEDUP_HOURS,
} from "../PassageDriftMonitor";

// Test fixture — a minimally-valid saved passage with a future departure
// and an existing risk score. Tests mutate one field at a time.
function passageAt(opts: {
  departureHoursFromNow: number;
  lastAlertHoursAgo?: number;
  withRiskScore?: boolean;
}) {
  const now = new Date("2026-05-26T12:00:00Z");
  const dep = new Date(now.getTime() + opts.departureHoursFromNow * 3600_000);
  const lastAlert = opts.lastAlertHoursAgo
    ? new Date(now.getTime() - opts.lastAlertHoursAgo * 3600_000).toISOString()
    : undefined;
  return {
    now,
    passage: {
      id: "p1",
      userId: "u1",
      plan: {
        summary: { departureTime: dep.toISOString() },
        riskScore: opts.withRiskScore !== false ? { score: 80 } : undefined,
        request: { departure: { latitude: 50, longitude: -1 } },
      },
      lastDriftAlertAt: lastAlert,
    } as any,
  };
}

describe("shouldAlert", () => {
  it(`fires only when score drops by >= ${ALERT_SCORE_DROP}`, () => {
    expect(shouldAlert({ score: 80 }, { score: 70 })).toBe(true);
    expect(shouldAlert({ score: 80 }, { score: 69 })).toBe(true);
    expect(shouldAlert({ score: 80 }, { score: 71 })).toBe(false);
  });

  it("never fires when score improves", () => {
    expect(shouldAlert({ score: 60 }, { score: 75 })).toBe(false);
  });

  it("guards against non-numeric inputs", () => {
    expect(shouldAlert({ score: NaN as any }, { score: 60 })).toBe(false);
    expect(shouldAlert({ score: 80 }, { score: "low" as any })).toBe(false);
  });
});

describe("isEligible", () => {
  it("passes for departures within the 72h window with a saved score", () => {
    const { passage, now } = passageAt({ departureHoursFromNow: 24 });
    expect(isEligible(passage, now)).toBe(true);
  });

  it("skips passages already departed", () => {
    const { passage, now } = passageAt({ departureHoursFromNow: -2 });
    expect(isEligible(passage, now)).toBe(false);
  });

  it(`skips passages beyond ${SCAN_LOOKAHEAD_HOURS}h out`, () => {
    const { passage, now } = passageAt({
      departureHoursFromNow: SCAN_LOOKAHEAD_HOURS + 2,
    });
    expect(isEligible(passage, now)).toBe(false);
  });

  it("includes passages at exactly the 72h boundary", () => {
    const { passage, now } = passageAt({
      departureHoursFromNow: SCAN_LOOKAHEAD_HOURS,
    });
    expect(isEligible(passage, now)).toBe(true);
  });

  it(`skips passages alerted within ${ALERT_DEDUP_HOURS}h`, () => {
    const { passage, now } = passageAt({
      departureHoursFromNow: 24,
      lastAlertHoursAgo: ALERT_DEDUP_HOURS - 1,
    });
    expect(isEligible(passage, now)).toBe(false);
  });

  it("re-eligible once the dedup window has passed", () => {
    const { passage, now } = passageAt({
      departureHoursFromNow: 24,
      lastAlertHoursAgo: ALERT_DEDUP_HOURS + 1,
    });
    expect(isEligible(passage, now)).toBe(true);
  });

  it("skips passages with no saved risk score (nothing to compare against)", () => {
    const { passage, now } = passageAt({
      departureHoursFromNow: 24,
      withRiskScore: false,
    });
    expect(isEligible(passage, now)).toBe(false);
  });

  it("skips passages with no departure time", () => {
    const { passage, now } = passageAt({ departureHoursFromNow: 24 });
    passage.plan.summary.departureTime = undefined;
    passage.plan.request.departure = {};
    expect(isEligible(passage, now)).toBe(false);
  });
});

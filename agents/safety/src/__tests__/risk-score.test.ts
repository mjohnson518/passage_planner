import { computeRiskScore, type RiskInput } from "../risk-score";

// Base "boring" passage that should clearly come back GO. Tests then mutate
// one field at a time to exercise specific transitions.
function baseInput(): RiskInput {
  return {
    vessel: {
      name: "Antares",
      lengthOverallFt: 35,
      cruiseSpeedKt: 6,
      draftFt: 5,
      maxWindKt: 30,
      maxWaveFt: 10,
    },
    crew: { size: 3, experience: "advanced" },
    passage: { distanceNm: 60, durationHr: 10 },
    weather: {
      maxWindKt: 12,
      maxGustKt: 16,
      maxWaveFt: 3,
      minVisibilityNm: 10,
      issuedAt: new Date(),
      available: true,
    },
    depth: { minClearanceFt: 12, available: true },
    hazards: {
      activePiracyOnRoute: false,
      restrictedAreasOnRoute: 0,
      iceHazardsOnRoute: 0,
      navWarningsCount: 0,
      available: true,
    },
    reserves: {
      fuelHoursPlanned: 10,
      fuelHoursAvailable: 25,
      waterDaysPlanned: 1,
      waterDaysAvailable: 3,
      available: true,
    },
  };
}

describe("computeRiskScore", () => {
  describe("happy path", () => {
    it("returns GO for benign conditions in a capable vessel", () => {
      const r = computeRiskScore(baseInput());
      expect(r.status).toBe("GO");
      expect(r.score).toBeGreaterThanOrEqual(75);
      expect(r.hardFails).toHaveLength(0);
      expect(r.breakdown.find((b) => b.category === "weather")?.status).toBe(
        "good",
      );
    });

    it("includes safety disclaimers on every output", () => {
      const r = computeRiskScore(baseInput());
      expect(r.disclaimers.length).toBeGreaterThan(0);
      expect(r.disclaimers.some((d) => /captain/i.test(d))).toBe(true);
    });

    it("breakdown weights sum to 1.0", () => {
      const r = computeRiskScore(baseInput());
      const total = r.breakdown.reduce((s, b) => s + b.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });
  });

  describe("CAUTION transitions", () => {
    it("drops to CAUTION when gusts approach vessel limit", () => {
      const i = baseInput();
      i.weather.maxGustKt = 27; // 90% of 30 kt limit
      const r = computeRiskScore(i);
      expect(["CAUTION", "NO-GO"]).toContain(r.status);
    });

    it("drops to CAUTION when visibility is reduced", () => {
      const i = baseInput();
      i.weather.minVisibilityNm = 2;
      const r = computeRiskScore(i);
      expect(["CAUTION", "GO"]).toContain(r.status);
      const wx = r.breakdown.find((b) => b.category === "weather");
      expect(wx?.contributors.some((c) => /[Vv]isibility/.test(c))).toBe(true);
    });

    it("drops to CAUTION when crew is appropriate but small for long passage", () => {
      const i = baseInput();
      i.crew.size = 2;
      i.passage.durationHr = 60;
      const r = computeRiskScore(i);
      const crew = r.breakdown.find((b) => b.category === "crew");
      expect(crew!.score).toBeLessThan(80);
    });
  });

  describe("NO-GO via hard fails", () => {
    it("gust above vessel limit triggers NO-GO immediately", () => {
      const i = baseInput();
      i.weather.maxGustKt = 35; // > 30 kt limit
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
      expect(r.hardFails.some((m) => /[Gg]ust/.test(m))).toBe(true);
    });

    it("wave above vessel limit triggers NO-GO", () => {
      const i = baseInput();
      i.weather.maxWaveFt = 12; // > 10 ft limit
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
      expect(r.hardFails.some((m) => /[Ww]ave/.test(m))).toBe(true);
    });

    it("wave > 0.6 × LOA triggers NO-GO even without explicit limit", () => {
      const i = baseInput();
      i.vessel.maxWaveFt = undefined;
      i.weather.maxWaveFt = 25; // > 0.6 × 35 ft LOA = 21 ft
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
    });

    it("active piracy on route triggers NO-GO", () => {
      const i = baseInput();
      i.hazards.activePiracyOnRoute = true;
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
      expect(r.hardFails.some((m) => /piracy/i.test(m))).toBe(true);
    });

    it("fuel reserve below 130% of need triggers NO-GO", () => {
      const i = baseInput();
      i.reserves.fuelHoursAvailable = 10; // 100% — below 130%
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
      expect(r.hardFails.some((m) => /[Ff]uel/.test(m))).toBe(true);
    });

    it("water reserve below 130% triggers NO-GO", () => {
      const i = baseInput();
      i.reserves.waterDaysAvailable = 1; // 100% — below 130%
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
      expect(r.hardFails.some((m) => /[Ww]ater/.test(m))).toBe(true);
    });

    it("visibility below 0.5 nm triggers NO-GO", () => {
      const i = baseInput();
      i.weather.minVisibilityNm = 0.3;
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
      expect(r.hardFails.some((m) => /[Vv]isibility/.test(m))).toBe(true);
    });

    it("stale weather (>1h old) triggers NO-GO", () => {
      const i = baseInput();
      i.weather.issuedAt = new Date(Date.now() - 90 * 60 * 1000);
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
      expect(r.hardFails.some((m) => /[Ww]eather data/.test(m))).toBe(true);
    });

    it("solo crew on overnight passage triggers NO-GO", () => {
      const i = baseInput();
      i.crew.size = 1;
      i.passage.durationHr = 24;
      const r = computeRiskScore(i);
      expect(r.status).toBe("NO-GO");
      expect(r.hardFails.some((m) => /[Cc]rew/.test(m))).toBe(true);
    });
  });

  describe("missing-data conservatism", () => {
    it("defaults weather to score 30 (unknown) when data unavailable", () => {
      const i = baseInput();
      i.weather.available = false;
      i.weather.maxWindKt = undefined;
      i.weather.maxGustKt = undefined;
      i.weather.maxWaveFt = undefined;
      const r = computeRiskScore(i);
      const wx = r.breakdown.find((b) => b.category === "weather");
      expect(wx!.score).toBe(30);
      expect(wx!.status).toBe("unknown");
      expect(r.dataMissing).toContain("weather forecast");
    });

    it("missing depth data → unknown / score 50, never asserts safety", () => {
      const i = baseInput();
      i.depth.available = false;
      i.depth.minClearanceFt = undefined;
      const r = computeRiskScore(i);
      const d = r.breakdown.find((b) => b.category === "depth");
      expect(d!.score).toBe(50);
      expect(d!.status).toBe("unknown");
    });
  });

  describe("multi-model uplift (R1 → R2 link)", () => {
    it("divergent model disagreement lowers the weather score", () => {
      const base = computeRiskScore(baseInput());
      const wxBase = base.breakdown.find((b) => b.category === "weather")!;

      const withDivergent = computeRiskScore({
        ...baseInput(),
        modelDisagreement: {
          windStatus: "divergent",
          waveStatus: "divergent",
        },
      });
      const wxDiv = withDivergent.breakdown.find(
        (b) => b.category === "weather",
      )!;
      expect(wxDiv.score).toBeLessThan(wxBase.score);
      expect(withDivergent.multiModelApplied).toBe(true);
    });

    it("mild model disagreement applies a smaller penalty than divergent", () => {
      const mild = computeRiskScore({
        ...baseInput(),
        modelDisagreement: { windStatus: "mild" },
      });
      const div = computeRiskScore({
        ...baseInput(),
        modelDisagreement: { windStatus: "divergent" },
      });
      const mildWx = mild.breakdown.find((b) => b.category === "weather")!;
      const divWx = div.breakdown.find((b) => b.category === "weather")!;
      expect(mildWx.score).toBeGreaterThan(divWx.score);
    });
  });

  describe("category bounds", () => {
    it("each category score is in [0, 100]", () => {
      const r = computeRiskScore(baseInput());
      for (const b of r.breakdown) {
        expect(b.score).toBeGreaterThanOrEqual(0);
        expect(b.score).toBeLessThanOrEqual(100);
      }
    });
    it("aggregate is in [0, 100]", () => {
      const r = computeRiskScore(baseInput());
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
  });
});

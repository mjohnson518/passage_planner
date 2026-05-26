import {
  parseExpeditionCsv,
  bilinearInterpolate,
  normalizedToVesselPolar,
  type NormalizedPolar,
} from "../PolarService";

describe("parseExpeditionCsv", () => {
  it("parses a tab-separated Expedition polar", () => {
    const csv = [
      "twa/tws\t6\t10\t14\t20",
      "0\t0\t0\t0\t0",
      "32\t3.5\t5.4\t6.1\t6.4",
      "90\t5.5\t7.5\t8.5\t9.0",
      "180\t3.0\t5.5\t7.0\t8.5",
    ].join("\n");
    const r = parseExpeditionCsv(csv);
    if (!r.ok) throw new Error(r.error);
    expect(r.polar.tws).toEqual([6, 10, 14, 20]);
    expect(r.polar.twa).toEqual([0, 32, 90, 180]);
    expect(r.polar.speeds.length).toBe(4);
    expect(r.polar.speeds[1]).toEqual([3.5, 5.4, 6.1, 6.4]);
  });

  it("parses semicolon-separated CSV (European locale)", () => {
    const csv = ["twa/tws;6;10", "0;0;0", "90;5.5;7.5"].join("\n");
    const r = parseExpeditionCsv(csv);
    if (!r.ok) throw new Error(r.error);
    expect(r.polar.tws).toEqual([6, 10]);
    expect(r.polar.speeds[1]).toEqual([5.5, 7.5]);
  });

  it("folds TWA > 180 into the [0,180] half (port/stbd symmetry)", () => {
    const csv = ["twa/tws\t10", "200\t5.0"].join("\n");
    const r = parseExpeditionCsv(csv);
    if (!r.ok) throw new Error(r.error);
    // 200° folds to 360-200 = 160°
    expect(r.polar.twa).toEqual([160]);
  });

  it("sorts rows by TWA even when CSV is unordered", () => {
    const csv = ["twa/tws\t10", "180\t5", "32\t4", "90\t6"].join("\n");
    const r = parseExpeditionCsv(csv);
    if (!r.ok) throw new Error(r.error);
    expect(r.polar.twa).toEqual([32, 90, 180]);
    expect(r.polar.speeds[0][0]).toBe(4);
  });

  it("rejects empty input", () => {
    const r = parseExpeditionCsv("");
    expect(r.ok).toBe(false);
  });

  it("rejects header with no TWS columns", () => {
    const r = parseExpeditionCsv("twa/tws\n32\t3.5");
    expect(r.ok).toBe(false);
  });

  it("rejects rows with wrong column count", () => {
    const csv = ["twa/tws\t6\t10", "32\t3.5"].join("\n");
    const r = parseExpeditionCsv(csv);
    expect(r.ok).toBe(false);
  });

  it("rejects negative speed values", () => {
    const csv = ["twa/tws\t10", "90\t-1.0"].join("\n");
    const r = parseExpeditionCsv(csv);
    expect(r.ok).toBe(false);
  });
});

describe("bilinearInterpolate", () => {
  const polar: NormalizedPolar = {
    tws: [10, 20],
    twa: [0, 90],
    speeds: [
      [0, 0], // TWA 0
      [4, 8], // TWA 90
    ],
  };

  it("returns exact cell value at a defined point", () => {
    expect(bilinearInterpolate(polar, 10, 90)).toBe(4);
    expect(bilinearInterpolate(polar, 20, 90)).toBe(8);
  });

  it("linearly interpolates within a row", () => {
    // halfway between 10kt and 20kt at TWA=90 → halfway between 4 and 8 = 6
    expect(bilinearInterpolate(polar, 15, 90)).toBeCloseTo(6, 5);
  });

  it("bilinearly interpolates inside the grid", () => {
    // TWS=15, TWA=45 → halfway between (0,0,4,8) → halfway between 0 and 6 = 3
    expect(bilinearInterpolate(polar, 15, 45)).toBeCloseTo(3, 5);
  });

  it("clamps out-of-range TWS to the polar's bounds", () => {
    // TWS=50kt should clamp to the 20kt column, not extrapolate
    expect(bilinearInterpolate(polar, 50, 90)).toBe(8);
    expect(bilinearInterpolate(polar, 2, 90)).toBe(4);
  });

  it("folds TWA > 180 into the [0,180] half", () => {
    // TWA=270 folds to 90; expect same speed as TWA=90 at the same TWS
    expect(bilinearInterpolate(polar, 10, 270)).toBe(4);
    // TWA=181 folds to 179 — close to (but not equal) 180; since 180 isn't
    // defined in this polar (only 0 and 90), 179 should clamp to the 90
    // bracket's upper end → 4 at TWS=10
    expect(bilinearInterpolate(polar, 10, 181)).toBeCloseTo(4, 5);
  });

  it("returns 0 for an empty polar", () => {
    const empty: NormalizedPolar = { tws: [], twa: [], speeds: [] };
    expect(bilinearInterpolate(empty, 10, 90)).toBe(0);
  });
});

describe("normalizedToVesselPolar", () => {
  it("expands the polar into a fine TWA grid the routing engine consumes", () => {
    const polar: NormalizedPolar = {
      tws: [10],
      twa: [0, 90, 180],
      speeds: [[0], [6], [4]],
    };
    const vp = normalizedToVesselPolar(polar, 30, 3);
    expect(vp.maxWindSpeed).toBe(30);
    expect(vp.maxWaveHeight).toBe(3);
    // Fine grid should include common TWA values
    expect(vp.speeds.has(0)).toBe(true);
    expect(vp.speeds.has(90)).toBe(true);
    expect(vp.speeds.has(180)).toBe(true);
    // Interpolated mid-points should be close to the analytical bilinear value
    const halfway = vp.speeds.get(46);
    expect(halfway?.get(10)).toBeCloseTo(3 + (6 - 3) * (46 / 90), 1);
  });
});

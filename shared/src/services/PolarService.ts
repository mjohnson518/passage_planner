// ============================================================================
// PolarService (V1) — parse, store, and look up vessel polar diagrams
//
// A polar table answers: "given true wind speed (TWS) and true wind angle
// (TWA), how fast does this boat go?" It's the heart of weather routing.
//
// We accept the Expedition CSV format — the de-facto standard used by
// Expedition (the leading pro routing software), B&G chartplotters, qtVlm,
// and most modern routing apps. The format is:
//
//   twa\tws    6    8    10    12    14    16    20    24    30
//   0          0    0    0     0     0     0     0     0     0
//   32         3.5  4.6  5.4   5.8   6.1   6.3   6.4   6.4   6.2
//   36         4.0  5.0  5.7   6.1   6.3   6.5   6.7   6.8   6.6
//   ...
//   180        3.0  4.2  5.5   6.3   7.0   7.6   8.5   9.2   9.6
//
// Separator may be tab, semicolon, or comma; first non-blank cell of the
// header is typically "twa/tws" (or similar) and is discarded. The first
// data column is TWA values, the rest are boat speeds at each TWS.
//
// Bilinear interpolation handles arbitrary TWS/TWA lookups during isochrone
// evaluation — boats sail at fractional wind speeds and angles, not just
// the cell values.
// ============================================================================

export interface NormalizedPolar {
  /** TWS values in knots, ascending. */
  tws: number[];
  /** TWA values in degrees [0..180], ascending. */
  twa: number[];
  /** Boat speeds in knots. speeds[twa_idx][tws_idx]. */
  speeds: number[][];
}

export interface PolarParseResult {
  ok: true;
  polar: NormalizedPolar;
}

export interface PolarParseError {
  ok: false;
  error: string;
}

/**
 * Parse an Expedition-format polar CSV. Returns either a parsed polar or
 * an error description suitable for surfacing to the user.
 */
export function parseExpeditionCsv(
  text: string,
): PolarParseResult | PolarParseError {
  if (!text || typeof text !== "string") {
    return { ok: false, error: "Empty polar file." };
  }
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length < 2) {
    return {
      ok: false,
      error: "Polar file needs a header and at least one data row.",
    };
  }

  const separator = detectSeparator(lines[0]);
  const split = (line: string): string[] =>
    line
      .split(separator)
      .map((cell) => cell.trim())
      .filter(
        (cell, idx, arr) =>
          // Allow trailing-blank cells to be dropped but keep internal blanks.
          idx < arr.length - 1 || cell.length > 0,
      );

  const headerCells = split(lines[0]);
  // First cell is a label ("twa/tws" or similar) — discard. Remaining cells
  // are TWS values.
  const tws = headerCells.slice(1).map((c) => Number(c));
  if (tws.length === 0 || tws.some((v) => !Number.isFinite(v) || v < 0)) {
    return {
      ok: false,
      error:
        "Header row does not contain valid TWS values after the label cell.",
    };
  }

  const twa: number[] = [];
  const speeds: number[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = split(lines[i]);
    if (row.length < 2) continue;
    const twaVal = Number(row[0]);
    if (!Number.isFinite(twaVal) || twaVal < 0 || twaVal > 360) {
      return {
        ok: false,
        error: `Row ${i + 1}: TWA "${row[0]}" is not a valid angle.`,
      };
    }
    // Normalize TWA into [0, 180] — boats are port/starboard symmetric so
    // polars usually only define one half. Values >180 fold back.
    const normalisedTwa = twaVal > 180 ? 360 - twaVal : twaVal;

    const rowSpeeds = row
      .slice(1, tws.length + 1)
      .map((c) => (c === "" ? 0 : Number(c)));
    if (rowSpeeds.length !== tws.length) {
      return {
        ok: false,
        error: `Row ${i + 1}: expected ${tws.length} speed cells, found ${rowSpeeds.length}.`,
      };
    }
    if (rowSpeeds.some((v) => !Number.isFinite(v) || v < 0)) {
      return {
        ok: false,
        error: `Row ${i + 1}: contains a non-numeric or negative speed value.`,
      };
    }
    twa.push(normalisedTwa);
    speeds.push(rowSpeeds);
  }

  if (twa.length === 0) {
    return { ok: false, error: "No data rows found after the header." };
  }

  // Sort by TWA in case the CSV wasn't ordered.
  const indices = twa.map((_, idx) => idx).sort((a, b) => twa[a] - twa[b]);
  const sortedTwa = indices.map((i) => twa[i]);
  const sortedSpeeds = indices.map((i) => speeds[i]);

  return {
    ok: true,
    polar: {
      tws,
      twa: sortedTwa,
      speeds: sortedSpeeds,
    },
  };
}

/**
 * Bilinearly interpolate a polar at arbitrary TWS / TWA. TWA is folded into
 * [0, 180] (boats are port/starboard symmetric). Out-of-range TWS is
 * clamped to the polar's bounds — extrapolating speeds beyond the polar's
 * defined range invents data and would be unsafe.
 */
export function bilinearInterpolate(
  polar: NormalizedPolar,
  tws: number,
  twa: number,
): number {
  if (
    polar.tws.length === 0 ||
    polar.twa.length === 0 ||
    polar.speeds.length === 0
  ) {
    return 0;
  }
  // Fold TWA into [0, 180].
  let foldedTwa = ((twa % 360) + 360) % 360;
  if (foldedTwa > 180) foldedTwa = 360 - foldedTwa;
  // Clamp TWS to the polar's defined range.
  const clampedTws = Math.max(
    polar.tws[0],
    Math.min(polar.tws[polar.tws.length - 1], tws),
  );

  const {
    lower: twsLowerIdx,
    upper: twsUpperIdx,
    fraction: twsFrac,
  } = bracket(polar.tws, clampedTws);
  const {
    lower: twaLowerIdx,
    upper: twaUpperIdx,
    fraction: twaFrac,
  } = bracket(polar.twa, foldedTwa);

  const lowerRow = polar.speeds[twaLowerIdx];
  const upperRow = polar.speeds[twaUpperIdx];

  const s00 = lowerRow[twsLowerIdx];
  const s01 = lowerRow[twsUpperIdx];
  const s10 = upperRow[twsLowerIdx];
  const s11 = upperRow[twsUpperIdx];

  // Bilinear: interpolate TWS along both TWA rows first, then between rows.
  const lowerSpeed = s00 + twsFrac * (s01 - s00);
  const upperSpeed = s10 + twsFrac * (s11 - s10);
  return lowerSpeed + twaFrac * (upperSpeed - lowerSpeed);
}

// ----------------------------------------------------------------------------
// Convert NormalizedPolar (JSON-friendly) → VesselPolar (Map-based, used by
// the orchestrator's WeatherRoutingService). The routing engine's
// `getBoatSpeed` does nearest-twa lookup with linear TWS interp; bilinear-
// quality output requires our normalizedToVesselPolar to populate the Map
// at a fine TWA resolution. We pre-interpolate into a 2° grid so the
// routing engine's nearest-TWA matcher gets a tight result.
// ----------------------------------------------------------------------------

export interface VesselPolarMap {
  speeds: Map<number, Map<number, number>>;
  maxWindSpeed: number;
  maxWaveHeight: number;
}

const FINE_TWA_STEP = 2;

export function normalizedToVesselPolar(
  polar: NormalizedPolar,
  maxWindKt: number,
  maxWaveM: number,
): VesselPolarMap {
  const speeds = new Map<number, Map<number, number>>();
  for (let twa = 0; twa <= 180; twa += FINE_TWA_STEP) {
    const twsMap = new Map<number, number>();
    for (const tws of polar.tws) {
      twsMap.set(tws, bilinearInterpolate(polar, tws, twa));
    }
    speeds.set(twa, twsMap);
  }
  return {
    speeds,
    maxWindSpeed: maxWindKt,
    maxWaveHeight: maxWaveM,
  };
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function detectSeparator(line: string): string {
  // Look at the first row; whichever separator produces the most columns
  // wins. Expedition exports vary (tabs from Excel, semicolons from European
  // locales, plain commas from hand-edited files).
  const tabs = line.split("\t").length;
  const semi = line.split(";").length;
  const comma = line.split(",").length;
  const max = Math.max(tabs, semi, comma);
  if (tabs === max) return "\t";
  if (semi === max) return ";";
  return ",";
}

function bracket(
  values: number[],
  target: number,
): { lower: number; upper: number; fraction: number } {
  // Assumes `values` is sorted ascending.
  if (target <= values[0]) return { lower: 0, upper: 0, fraction: 0 };
  if (target >= values[values.length - 1]) {
    const last = values.length - 1;
    return { lower: last, upper: last, fraction: 0 };
  }
  for (let i = 0; i < values.length - 1; i++) {
    if (target >= values[i] && target <= values[i + 1]) {
      const span = values[i + 1] - values[i];
      const frac = span > 0 ? (target - values[i]) / span : 0;
      return { lower: i, upper: i + 1, fraction: frac };
    }
  }
  // Fallback (shouldn't reach here given guards above).
  const last = values.length - 1;
  return { lower: last, upper: last, fraction: 0 };
}

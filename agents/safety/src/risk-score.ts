// ============================================================================
// Risk score (R2)
//
// Reduces an assembled passage plan into a single sailor-facing verdict:
// GO / CAUTION / NO-GO, backed by a 0–100 aggregate score and a per-category
// breakdown. Designed as DECISION SUPPORT, not a decision — the captain
// retains final authority. Every disclaimer baked into the output reflects
// that contract.
//
// Two paths to NO-GO:
//   1) Aggregate score < 50 or any individual category < 30
//   2) Any "hard fail" condition (wind > vessel limit, piracy on route,
//      reserves below need, etc.). Hard fails bypass weighted math entirely
//      so a benign average can never rubber-stamp a clearly dangerous trip.
//
// Conservatism principles:
//   - Worst-case for wind/gust/wave; best-case-of-bad for visibility/depth
//   - Missing data downgrades to CAUTION rather than asserting GO
//   - When multi-model disagreement is wide, widen the safety bounds further
//     (this is the Premium uplift — Free users get the same scoring math
//     using single-model data)
//
// This module is intentionally PURE — no I/O, no logging — so it's trivial
// to unit-test under safety-critical coverage requirements (≥90%, see
// CLAUDE.md). The caller writes audit logs around the call.
// ============================================================================

export type RiskStatus = "GO" | "CAUTION" | "NO-GO";

export type CategoryStatus = "good" | "marginal" | "poor" | "unknown";

export type RiskCategoryName =
  | "weather"
  | "depth"
  | "hazards"
  | "reserves"
  | "crew";

export interface RiskCategoryScore {
  category: RiskCategoryName;
  weight: number; // 0..1
  score: number; // 0..100
  status: CategoryStatus;
  contributors: string[];
}

export interface RiskScore {
  score: number; // 0..100
  status: RiskStatus;
  breakdown: RiskCategoryScore[];
  hardFails: string[];
  disclaimers: string[];
  dataMissing: string[];
  generatedAt: string;
  weatherDataAgeMin: number | null;
  multiModelApplied: boolean;
}

export interface RiskInput {
  vessel: {
    name?: string;
    lengthOverallFt?: number;
    cruiseSpeedKt?: number;
    draftFt?: number;
    maxWindKt?: number;
    maxWaveFt?: number;
  };
  crew: {
    size?: number;
    experience?: "novice" | "intermediate" | "advanced" | "professional";
  };
  passage: {
    distanceNm?: number;
    durationHr?: number;
  };
  weather: {
    maxWindKt?: number;
    maxGustKt?: number;
    maxWaveFt?: number;
    minVisibilityNm?: number;
    issuedAt?: string | Date;
    available: boolean;
  };
  depth: {
    minClearanceFt?: number;
    available: boolean;
  };
  hazards: {
    activePiracyOnRoute: boolean;
    restrictedAreasOnRoute: number;
    iceHazardsOnRoute: number;
    navWarningsCount: number;
    available: boolean;
  };
  reserves: {
    fuelHoursPlanned?: number;
    fuelHoursAvailable?: number;
    waterDaysPlanned?: number;
    waterDaysAvailable?: number;
    available: boolean;
  };
  /** R1 multi-model spread (when Premium + multiModel requested). When present
   *  with status="divergent", scoring widens its safety bounds. */
  modelDisagreement?: {
    windStatus?: "agree" | "mild" | "divergent";
    waveStatus?: "agree" | "mild" | "divergent";
  };
}

const WEIGHTS: Record<RiskCategoryName, number> = {
  weather: 0.4,
  depth: 0.2,
  hazards: 0.2,
  reserves: 0.1,
  crew: 0.1,
};

const STALE_WEATHER_MIN = 60; // > 1 h = stale (matches existing Helmwise rule)
const MIN_VIS_HARD_FAIL_NM = 0.5;
const RESERVE_BUFFER_FRAC = 0.3; // need >=130% of projected use
const MIN_CREW_FOR_OVERNIGHT = 2;
const OVERNIGHT_DURATION_HR = 12;

const DISCLAIMERS: string[] = [
  "This is decision support, not a decision. The captain retains final authority.",
  "Based on the conditions and inputs available at score generation time.",
  "Re-check the forecast and re-run within 6 hours of departure.",
];

export function computeRiskScore(input: RiskInput): RiskScore {
  const hardFails: string[] = [];
  const dataMissing: string[] = [];
  const generatedAt = new Date().toISOString();
  const issuedAt = input.weather.issuedAt
    ? new Date(input.weather.issuedAt)
    : null;
  const weatherDataAgeMin =
    issuedAt && Number.isFinite(issuedAt.getTime())
      ? (Date.now() - issuedAt.getTime()) / 60000
      : null;
  const multiModelApplied = !!input.modelDisagreement;

  // ---- hard-fail evaluation ---------------------------------------------
  if (weatherDataAgeMin !== null && weatherDataAgeMin > STALE_WEATHER_MIN) {
    hardFails.push(
      `Weather data is ${Math.round(weatherDataAgeMin)} min old (limit ${STALE_WEATHER_MIN} min).`,
    );
  }

  const vesselMaxWind = input.vessel.maxWindKt;
  if (vesselMaxWind && input.weather.maxGustKt !== undefined) {
    if (input.weather.maxGustKt > vesselMaxWind) {
      hardFails.push(
        `Forecast gust ${input.weather.maxGustKt.toFixed(0)} kt exceeds vessel limit ${vesselMaxWind} kt.`,
      );
    }
  }

  const vesselMaxWave = input.vessel.maxWaveFt;
  if (vesselMaxWave && input.weather.maxWaveFt !== undefined) {
    if (input.weather.maxWaveFt > vesselMaxWave) {
      hardFails.push(
        `Forecast wave ${input.weather.maxWaveFt.toFixed(1)} ft exceeds vessel limit ${vesselMaxWave} ft.`,
      );
    }
  }
  // Wave > 2x LOA is unsafe for any vessel — captures the case where the
  // user hasn't set vessel.maxWaveFt explicitly.
  if (input.vessel.lengthOverallFt && input.weather.maxWaveFt !== undefined) {
    if (input.weather.maxWaveFt > input.vessel.lengthOverallFt * 0.6) {
      hardFails.push(
        `Forecast wave ${input.weather.maxWaveFt.toFixed(1)} ft is dangerous for a ${input.vessel.lengthOverallFt}-ft vessel.`,
      );
    }
  }

  if (
    input.weather.minVisibilityNm !== undefined &&
    input.weather.minVisibilityNm < MIN_VIS_HARD_FAIL_NM
  ) {
    hardFails.push(
      `Visibility ${input.weather.minVisibilityNm.toFixed(1)} nm at some point of the passage is below the ${MIN_VIS_HARD_FAIL_NM} nm safety floor.`,
    );
  }

  if (input.hazards.available && input.hazards.activePiracyOnRoute) {
    hardFails.push(
      "Active piracy / anti-shipping incidents reported within the route corridor.",
    );
  }

  if (input.reserves.available) {
    const fuelOk =
      input.reserves.fuelHoursPlanned === undefined ||
      input.reserves.fuelHoursAvailable === undefined
        ? null
        : input.reserves.fuelHoursAvailable >=
          input.reserves.fuelHoursPlanned * (1 + RESERVE_BUFFER_FRAC);
    if (fuelOk === false) {
      hardFails.push(
        `Fuel reserve (${input.reserves.fuelHoursAvailable!.toFixed(1)} h) below 130% of projected use (${input.reserves.fuelHoursPlanned!.toFixed(1)} h).`,
      );
    }
    const waterOk =
      input.reserves.waterDaysPlanned === undefined ||
      input.reserves.waterDaysAvailable === undefined
        ? null
        : input.reserves.waterDaysAvailable >=
          input.reserves.waterDaysPlanned * (1 + RESERVE_BUFFER_FRAC);
    if (waterOk === false) {
      hardFails.push(
        `Water reserve (${input.reserves.waterDaysAvailable!.toFixed(1)} d) below 130% of projected use (${input.reserves.waterDaysPlanned!.toFixed(1)} d).`,
      );
    }
  }

  const durationHr = input.passage.durationHr ?? 0;
  const crewSize = input.crew.size ?? 0;
  if (durationHr > OVERNIGHT_DURATION_HR && crewSize < MIN_CREW_FOR_OVERNIGHT) {
    hardFails.push(
      `Crew of ${crewSize} cannot sustainably stand watches over a ${durationHr.toFixed(0)}-h passage (minimum ${MIN_CREW_FOR_OVERNIGHT}).`,
    );
  }

  // ---- per-category scoring ---------------------------------------------
  const breakdown: RiskCategoryScore[] = [
    scoreWeather(input, dataMissing),
    scoreDepth(input, dataMissing),
    scoreHazards(input, dataMissing),
    scoreReserves(input, dataMissing),
    scoreCrew(input, dataMissing),
  ];

  // Aggregate is a weighted average of category scores.
  const aggregate = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0);

  // Status derivation — hard fails always win.
  let status: RiskStatus;
  if (hardFails.length > 0) {
    status = "NO-GO";
  } else {
    const anyPoor = breakdown.some((b) => b.score < 30);
    const anyMarginal = breakdown.some((b) => b.score < 40);
    if (aggregate < 50 || anyPoor) status = "NO-GO";
    else if (aggregate < 75 || anyMarginal) status = "CAUTION";
    else status = "GO";
  }

  return {
    score: Math.round(aggregate),
    status,
    breakdown,
    hardFails,
    disclaimers: DISCLAIMERS,
    dataMissing,
    generatedAt,
    weatherDataAgeMin,
    multiModelApplied,
  };
}

// ----------------------------------------------------------------------------
// Per-category scorers — each returns 0..100. Returning 50 ("unknown") when
// data is missing keeps the user in CAUTION instead of asserting safety we
// can't justify.
// ----------------------------------------------------------------------------

function scoreWeather(
  input: RiskInput,
  dataMissing: string[],
): RiskCategoryScore {
  const contributors: string[] = [];

  if (!input.weather.available) {
    dataMissing.push("weather forecast");
    return {
      category: "weather",
      weight: WEIGHTS.weather,
      score: 30,
      status: "unknown",
      contributors: ["Weather data unavailable — defaulting to CAUTION."],
    };
  }

  // Start at 100 and subtract penalties for unfavorable conditions. The point
  // is conservatism — every adverse signal moves us downward.
  let score = 100;
  const gust = input.weather.maxGustKt ?? input.weather.maxWindKt ?? 0;
  const wave = input.weather.maxWaveFt ?? 0;
  const vis = input.weather.minVisibilityNm ?? 10;

  // Wind/gust penalty curves (kt) — calibrated against vessel limits when set,
  // otherwise against generic "intermediate cruiser" thresholds.
  const windLimit = input.vessel.maxWindKt ?? 25;
  if (gust >= windLimit * 0.9) {
    score -= 35;
    contributors.push(
      `Gusts ${gust.toFixed(0)} kt near vessel limit ${windLimit} kt.`,
    );
  } else if (gust >= windLimit * 0.7) {
    score -= 18;
    contributors.push(`Gusts ${gust.toFixed(0)} kt at 70%+ of vessel limit.`);
  } else if (gust >= windLimit * 0.5) {
    score -= 8;
    contributors.push(`Gusts ${gust.toFixed(0)} kt are moderate.`);
  } else {
    contributors.push(`Gusts ${gust.toFixed(0)} kt are well within limits.`);
  }

  // Wave penalty — feet.
  const waveLimit = input.vessel.maxWaveFt ?? 8;
  if (wave >= waveLimit * 0.9) {
    score -= 25;
    contributors.push(
      `Waves ${wave.toFixed(1)} ft near vessel limit ${waveLimit} ft.`,
    );
  } else if (wave >= waveLimit * 0.7) {
    score -= 12;
    contributors.push(`Waves ${wave.toFixed(1)} ft at 70%+ of vessel limit.`);
  } else if (wave > 0) {
    contributors.push(`Waves ${wave.toFixed(1)} ft within comfortable range.`);
  }

  // Visibility — nm.
  if (vis < 1) {
    score -= 25;
    contributors.push(`Visibility ${vis.toFixed(1)} nm is dangerously low.`);
  } else if (vis < 3) {
    score -= 12;
    contributors.push(`Visibility ${vis.toFixed(1)} nm is reduced.`);
  }

  // Multi-model widening (R1 → R2 link): if Premium showed divergent
  // forecasts, dock additional points so the score reflects lower confidence.
  if (input.modelDisagreement?.windStatus === "divergent") {
    score -= 10;
    contributors.push(
      "Forecast models disagree significantly on wind — confidence is low.",
    );
  } else if (input.modelDisagreement?.windStatus === "mild") {
    score -= 4;
    contributors.push("Forecast models show mild wind disagreement.");
  }
  if (input.modelDisagreement?.waveStatus === "divergent") {
    score -= 8;
    contributors.push(
      "Forecast models disagree significantly on waves — confidence is low.",
    );
  }

  score = Math.max(0, Math.min(100, score));
  return {
    category: "weather",
    weight: WEIGHTS.weather,
    score,
    status: scoreToStatus(score),
    contributors,
  };
}

function scoreDepth(
  input: RiskInput,
  dataMissing: string[],
): RiskCategoryScore {
  const contributors: string[] = [];

  if (!input.depth.available) {
    dataMissing.push("depth/tidal");
    return {
      category: "depth",
      weight: WEIGHTS.depth,
      score: 50,
      status: "unknown",
      contributors: ["Depth/tidal data unavailable along route."],
    };
  }

  const clearance = input.depth.minClearanceFt;
  if (clearance === undefined) {
    return {
      category: "depth",
      weight: WEIGHTS.depth,
      score: 70,
      status: "marginal",
      contributors: ["No specific clearance measurements returned."],
    };
  }

  const draft = input.vessel.draftFt ?? 5;
  // Helmwise mandate: 20% clearance under keel minimum.
  const requiredClearance = draft * 0.2;
  if (clearance < requiredClearance) {
    contributors.push(
      `Minimum clearance ${clearance.toFixed(1)} ft below required ${requiredClearance.toFixed(1)} ft (20% of draft).`,
    );
    return {
      category: "depth",
      weight: WEIGHTS.depth,
      score: 20,
      status: "poor",
      contributors,
    };
  }
  if (clearance < requiredClearance * 2) {
    contributors.push(
      `Clearance ${clearance.toFixed(1)} ft is tight (less than 2× required).`,
    );
    return {
      category: "depth",
      weight: WEIGHTS.depth,
      score: 60,
      status: "marginal",
      contributors,
    };
  }
  contributors.push(`Clearance ${clearance.toFixed(1)} ft is comfortable.`);
  return {
    category: "depth",
    weight: WEIGHTS.depth,
    score: 95,
    status: "good",
    contributors,
  };
}

function scoreHazards(
  input: RiskInput,
  dataMissing: string[],
): RiskCategoryScore {
  const contributors: string[] = [];

  if (!input.hazards.available) {
    dataMissing.push("hazards");
    return {
      category: "hazards",
      weight: WEIGHTS.hazards,
      score: 60,
      status: "unknown",
      contributors: ["Hazard feeds unavailable; cannot rule out warnings."],
    };
  }

  let score = 100;
  if (input.hazards.activePiracyOnRoute) {
    score -= 80;
    contributors.push("Active piracy zone on route.");
  }
  if (input.hazards.restrictedAreasOnRoute > 0) {
    score -= 15 * Math.min(3, input.hazards.restrictedAreasOnRoute);
    contributors.push(
      `${input.hazards.restrictedAreasOnRoute} restricted area${input.hazards.restrictedAreasOnRoute === 1 ? "" : "s"} on or near route.`,
    );
  }
  if (input.hazards.iceHazardsOnRoute > 0) {
    score -= 25 * Math.min(2, input.hazards.iceHazardsOnRoute);
    contributors.push(
      `${input.hazards.iceHazardsOnRoute} ice hazard${input.hazards.iceHazardsOnRoute === 1 ? "" : "s"} on or near route.`,
    );
  }
  if (input.hazards.navWarningsCount > 0) {
    score -= 5 * Math.min(4, input.hazards.navWarningsCount);
    contributors.push(
      `${input.hazards.navWarningsCount} navigation warning${input.hazards.navWarningsCount === 1 ? "" : "s"} active.`,
    );
  }
  if (contributors.length === 0) {
    contributors.push("No hazards reported on the planned route.");
  }
  score = Math.max(0, Math.min(100, score));
  return {
    category: "hazards",
    weight: WEIGHTS.hazards,
    score,
    status: scoreToStatus(score),
    contributors,
  };
}

function scoreReserves(
  input: RiskInput,
  dataMissing: string[],
): RiskCategoryScore {
  const contributors: string[] = [];
  if (!input.reserves.available) {
    dataMissing.push("reserves");
    return {
      category: "reserves",
      weight: WEIGHTS.reserves,
      score: 60,
      status: "unknown",
      contributors: ["Fuel/water reserves not entered."],
    };
  }

  let score = 100;
  const required = (need: number) => need * (1 + RESERVE_BUFFER_FRAC);

  if (
    input.reserves.fuelHoursPlanned !== undefined &&
    input.reserves.fuelHoursAvailable !== undefined
  ) {
    const need = required(input.reserves.fuelHoursPlanned);
    const ratio = input.reserves.fuelHoursAvailable / need;
    if (ratio >= 1.2) {
      contributors.push(
        `Fuel reserve ${input.reserves.fuelHoursAvailable.toFixed(1)} h is comfortable (${Math.round(ratio * 100)}% of need).`,
      );
    } else if (ratio >= 1) {
      score -= 15;
      contributors.push(
        `Fuel reserve ${input.reserves.fuelHoursAvailable.toFixed(1)} h is tight (${Math.round(ratio * 100)}% of need).`,
      );
    } else {
      // Below need triggers the hard-fail above; we still dock the score
      // for completeness so the hero card shows the failure category.
      score -= 50;
      contributors.push(
        `Fuel reserve ${input.reserves.fuelHoursAvailable.toFixed(1)} h is INSUFFICIENT (${Math.round(ratio * 100)}% of need).`,
      );
    }
  } else {
    dataMissing.push("fuel reserves");
  }

  if (
    input.reserves.waterDaysPlanned !== undefined &&
    input.reserves.waterDaysAvailable !== undefined
  ) {
    const need = required(input.reserves.waterDaysPlanned);
    const ratio = input.reserves.waterDaysAvailable / need;
    if (ratio >= 1.2) {
      contributors.push(
        `Water reserve ${input.reserves.waterDaysAvailable.toFixed(1)} d is comfortable.`,
      );
    } else if (ratio >= 1) {
      score -= 10;
      contributors.push(
        `Water reserve ${input.reserves.waterDaysAvailable.toFixed(1)} d is tight.`,
      );
    } else {
      score -= 40;
      contributors.push(
        `Water reserve ${input.reserves.waterDaysAvailable.toFixed(1)} d is INSUFFICIENT.`,
      );
    }
  } else {
    dataMissing.push("water reserves");
  }

  score = Math.max(0, Math.min(100, score));
  return {
    category: "reserves",
    weight: WEIGHTS.reserves,
    score,
    status: scoreToStatus(score),
    contributors,
  };
}

function scoreCrew(
  input: RiskInput,
  _dataMissing: string[],
): RiskCategoryScore {
  const contributors: string[] = [];
  const size = input.crew.size ?? 0;
  const exp = input.crew.experience ?? "intermediate";
  const duration = input.passage.durationHr ?? 0;

  let score = 100;

  if (size === 0) {
    score = 40;
    contributors.push("Crew size not specified.");
  } else if (
    duration > OVERNIGHT_DURATION_HR &&
    size < MIN_CREW_FOR_OVERNIGHT
  ) {
    score -= 50;
    contributors.push(
      `Crew of ${size} on a ${duration.toFixed(0)}-h passage cannot stand watches sustainably.`,
    );
  } else if (duration > 48 && size < 3) {
    score -= 25;
    contributors.push(
      `Crew of ${size} on a ${duration.toFixed(0)}-h passage will be fatigued.`,
    );
  } else {
    contributors.push(`Crew of ${size} appropriate for passage duration.`);
  }

  const expPenalty: Record<typeof exp, number> = {
    novice: 30,
    intermediate: 10,
    advanced: 0,
    professional: 0,
  };
  score -= expPenalty[exp];
  if (expPenalty[exp] > 0) {
    contributors.push(
      `Crew experience "${exp}" reduces tolerance for marginal conditions.`,
    );
  }

  score = Math.max(0, Math.min(100, score));
  return {
    category: "crew",
    weight: WEIGHTS.crew,
    score,
    status: scoreToStatus(score),
    contributors,
  };
}

function scoreToStatus(score: number): CategoryStatus {
  if (score >= 75) return "good";
  if (score >= 50) return "marginal";
  return "poor";
}

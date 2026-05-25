import type { MultiModelMarineForecast } from "./OpenMeteoWeatherService";

// ============================================================================
// MultiModelDisagreement (R1)
//
// Pure helper that turns a multi-model forecast into a sailor-facing summary
// of where the models agree and where they don't. The principle:
//
//   Forecasts that disagree tell you something — confidence is low, the
//   regime is hard to predict, and the safety mantra "plan for worst case"
//   applies more strongly.
//
// Each variable (wind speed, wind gust, wave height, temperature) is bucketed
// into one of three agreement states using thresholds drawn from operational
// forecasting practice:
//
//   wind   <5 kt  spread = agree   5-10 = mild   >10 = divergent
//   wave   <0.5m  spread = agree   0.5-1 = mild  >1m = divergent
//   temp   <2°F   spread = agree   2-5  = mild   >5 = divergent
//
// For every variable we surface both the consensus (median) and the worst
// case (max wind/gust/wave) so the UI can satisfy the safety-first contract
// while also showing what each model said.
// ============================================================================

export type AgreementStatus = "agree" | "mild" | "divergent";

export interface VariableAgreement {
  variable:
    | "wind_speed_kt"
    | "wind_gust_kt"
    | "wave_height_m"
    | "temperature_f";
  /** Median across models — used as the "consensus" display value. */
  consensus: number;
  /** Worst case (max for wind/wave, min for vis if added later). Used for
   *  safety-margin computations downstream. */
  worstCase: number;
  /** Spread = max - min across models. */
  spread: number;
  status: AgreementStatus;
  /** Per-model values keyed by model name so the UI can render a stacked
   *  comparison. NaN entries are filtered out before status calculation. */
  perModel: Record<string, number>;
}

export interface ModelComparisonSummary {
  location: { latitude: number; longitude: number };
  issuedAt: string;
  models: string[];
  /** Per-variable agreement at the index nearest to `evaluatedAt`. */
  evaluatedAt: string;
  windSpeed: VariableAgreement | null;
  windGust: VariableAgreement | null;
  waveHeight: VariableAgreement | null;
  temperature: VariableAgreement | null;
  /** Human-readable line summarising what to do about the disagreement. */
  recommendation: string;
}

const THRESHOLDS = {
  wind_speed_kt: { mild: 5, divergent: 10 },
  wind_gust_kt: { mild: 7, divergent: 15 },
  wave_height_m: { mild: 0.5, divergent: 1 },
  temperature_f: { mild: 2, divergent: 5 },
} as const;

/**
 * Summarise model disagreement at the hour nearest the requested target.
 * Returns null for any variable a model didn't produce data for.
 */
export function summariseModelDisagreement(
  forecast: MultiModelMarineForecast,
  targetTime: Date = new Date(),
): ModelComparisonSummary {
  const modelNames = forecast.models.map((m) => m.model);

  // Pick the timestamp closest to targetTime in the FIRST model's time array.
  // All models share the same time grid, so any will do.
  const idx = nearestTimeIndex(forecast.models[0]?.time ?? [], targetTime);
  const evaluatedAtIso =
    forecast.models[0]?.time?.[idx] ?? new Date().toISOString();

  const windSpeed = summariseVariable(
    "wind_speed_kt",
    forecast.models.map((m) => ({
      model: m.model,
      value: m.windSpeedKt?.[idx],
    })),
  );
  const windGust = summariseVariable(
    "wind_gust_kt",
    forecast.models.map((m) => ({
      model: m.model,
      value: m.windGustKt?.[idx],
    })),
  );
  const waveHeight = summariseVariable(
    "wave_height_m",
    forecast.models
      .filter((m) => m.waveHeightM !== undefined)
      .map((m) => ({
        model: m.model,
        value: m.waveHeightM?.[idx],
      })),
  );
  const temperature = summariseVariable(
    "temperature_f",
    forecast.models.map((m) => ({
      model: m.model,
      value: m.temperatureF?.[idx],
    })),
  );

  const recommendation = buildRecommendation({
    windSpeed,
    windGust,
    waveHeight,
    temperature,
  });

  return {
    location: forecast.location,
    issuedAt: new Date(forecast.issuedAt).toISOString(),
    models: modelNames,
    evaluatedAt: evaluatedAtIso,
    windSpeed,
    windGust,
    waveHeight,
    temperature,
    recommendation,
  };
}

function summariseVariable(
  variable: VariableAgreement["variable"],
  values: Array<{ model: string; value: number | undefined }>,
): VariableAgreement | null {
  const valid = values.filter(
    (v): v is { model: string; value: number } =>
      v.value !== undefined && Number.isFinite(v.value),
  );
  if (valid.length === 0) return null;

  const nums = valid.map((v) => v.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const spread = max - min;
  const consensus = median(nums);
  // For wind / gust / wave the worst case is the max; for temperature both
  // directions are "uncomfortable" but we surface max to be consistent. UI
  // can present either context for temperature without misleading.
  const worstCase = max;

  const thresholds = THRESHOLDS[variable];
  let status: AgreementStatus;
  if (spread < thresholds.mild) status = "agree";
  else if (spread < thresholds.divergent) status = "mild";
  else status = "divergent";

  return {
    variable,
    consensus,
    worstCase,
    spread,
    status,
    perModel: Object.fromEntries(valid.map((v) => [v.model, v.value])),
  };
}

function buildRecommendation(parts: {
  windSpeed: VariableAgreement | null;
  windGust: VariableAgreement | null;
  waveHeight: VariableAgreement | null;
  temperature: VariableAgreement | null;
}): string {
  const concerns: string[] = [];
  if (parts.windSpeed?.status === "divergent") {
    concerns.push(
      `wind speed (${parts.windSpeed.spread.toFixed(0)} kt spread; max ${parts.windSpeed.worstCase.toFixed(0)} kt)`,
    );
  } else if (parts.windSpeed?.status === "mild") {
    concerns.push(
      `wind speed (${parts.windSpeed.spread.toFixed(0)} kt spread)`,
    );
  }
  if (parts.waveHeight?.status === "divergent") {
    concerns.push(
      `wave height (${parts.waveHeight.spread.toFixed(1)} m spread; max ${parts.waveHeight.worstCase.toFixed(1)} m)`,
    );
  } else if (parts.waveHeight?.status === "mild") {
    concerns.push(
      `wave height (${parts.waveHeight.spread.toFixed(1)} m spread)`,
    );
  }

  if (concerns.length === 0) {
    return "Models agree across all variables. Forecast confidence is high.";
  }
  const hasDivergent =
    parts.windSpeed?.status === "divergent" ||
    parts.waveHeight?.status === "divergent";
  if (hasDivergent) {
    return (
      `Significant model disagreement on ${concerns.join(" and ")}. ` +
      `Plan for the worst case and re-check the forecast within 6 hours of departure.`
    );
  }
  return (
    `Mild model disagreement on ${concerns.join(" and ")}. ` +
    `Lean toward the worst-case values when sizing reefing/reefing decisions.`
  );
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function nearestTimeIndex(times: string[], target: Date): number {
  if (times.length === 0) return 0;
  const targetMs = target.getTime();
  let bestIdx = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

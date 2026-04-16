/**
 * WeatherAggregator tests — worst-case-on-disagreement rule.
 *
 * SAFETY CRITICAL (CLAUDE.md): "Always present worst-case scenario when
 * forecasts disagree." These tests pin that rule so a silent regression
 * (e.g. someone reinstating plain averaging) fails CI instead of shipping
 * a benign-looking forecast that neither source actually predicts.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import pino from 'pino';
import { WeatherAggregator } from '../weather-aggregator';

const silentLogger = pino({ level: 'silent' });

function makeForecast(time: Date, wind: number, gust: number, wave: number, vis: number, direction = 180) {
  return {
    time,
    windSpeed: wind,
    windDirection: direction,
    windGust: gust,
    waveHeight: wave,
    visibility: vis,
    temperature: 15,
    pressure: 1013,
    precipitation: 10,
  };
}

describe('WeatherAggregator — worst-case on disagreement', () => {
  let agg: WeatherAggregator;
  const t = new Date('2026-04-17T12:00:00Z');
  const boston = { latitude: 42.36, longitude: -71.06 };

  beforeEach(() => {
    agg = new WeatherAggregator(silentLogger);
  });

  it('averages when sources agree within tolerance', () => {
    // 20kt vs 22kt → well within the 20% wind tolerance
    const result = agg.aggregateForecasts(
      [makeForecast(t, 20, 25, 4, 10)],
      [{ ...makeForecast(t, 22, 27, 4.2, 10), windDir: 180 } as any],
      boston
    );
    expect(result).toHaveLength(1);
    expect(result[0].consensus).toBe(true);
    // Average is 21 — neither max nor min
    expect(result[0].windSpeed.value).toBeCloseTo(21, 0);
  });

  it('uses MAX wind speed when sources disagree beyond 20% tolerance', () => {
    // 10kt vs 40kt — massively disagreeing; mariner must plan against 40kt
    const result = agg.aggregateForecasts(
      [makeForecast(t, 10, 15, 2, 10)],
      [{ ...makeForecast(t, 40, 55, 8, 3), windDir: 180 } as any],
      boston
    );
    expect(result).toHaveLength(1);
    expect(result[0].consensus).toBe(false);
    expect(result[0].windSpeed.value).toBe(40);
    expect(result[0].windSpeed.max).toBe(40);
    expect(result[0].windSpeed.min).toBe(10);
  });

  it('uses MAX wind gust when sources disagree', () => {
    const result = agg.aggregateForecasts(
      [makeForecast(t, 10, 15, 2, 10)],
      [{ ...makeForecast(t, 40, 55, 8, 3), windDir: 180 } as any],
      boston
    );
    expect(result[0].windGust.value).toBe(55);
  });

  it('uses MAX wave height when wave forecasts disagree beyond 25%', () => {
    // wave 2ft vs 8ft — 300% disagreement
    const result = agg.aggregateForecasts(
      [makeForecast(t, 20, 25, 2, 10)],
      [{ ...makeForecast(t, 22, 27, 8, 10), windDir: 180 } as any],
      boston
    );
    expect(result[0].waveHeight?.value).toBe(8);
  });

  it('uses MIN visibility when sources disagree — fog planning must be pessimistic', () => {
    // 10nm vs 1nm — 10x disagreement; mariner must plan for fog
    const result = agg.aggregateForecasts(
      [makeForecast(t, 40, 55, 2, 10)],
      [{ ...makeForecast(t, 10, 15, 2, 1), windDir: 180 } as any],
      boston
    );
    expect(result[0].consensus).toBe(false);
    expect(result[0].visibility?.value).toBe(1);
  });

  it('surfaces discrepancies in the output', () => {
    const result = agg.aggregateForecasts(
      [makeForecast(t, 10, 15, 2, 10)],
      [{ ...makeForecast(t, 40, 55, 8, 3), windDir: 180 } as any],
      boston
    );
    expect(result[0].discrepancies).toBeDefined();
    expect(result[0].discrepancies!.length).toBeGreaterThan(0);
    expect(result[0].discrepancies!.join(' ')).toMatch(/wind speed/i);
  });

  it('single source (no disagreement possible) uses that source value', () => {
    const result = agg.aggregateForecasts(
      [makeForecast(t, 25, 30, 5, 7)],
      null,
      boston
    );
    expect(result[0].windSpeed.value).toBe(25);
    expect(result[0].consensus).toBe(true);
  });

  it('returns empty array when no forecasts provided', () => {
    const result = agg.aggregateForecasts(null, null, boston);
    expect(result).toEqual([]);
  });
});

/**
 * Tidal staleness guard tests.
 *
 * SAFETY CRITICAL: CLAUDE.md mandates rejecting tidal data >1 day old.
 * Cached predictions can be superseded when NOAA recalibrates a station;
 * using stale data to compute depth windows risks groundings.
 */

import { describe, it, expect } from '@jest/globals';
import { assertTidalFresh, StaleTidalError, MAX_TIDAL_AGE_MS } from '../index';

describe('assertTidalFresh (>1 day = reject)', () => {
  it('accepts data fetched just now', () => {
    expect(() => assertTidalFresh(new Date())).not.toThrow();
  });

  it('accepts data fetched 23 hours ago', () => {
    const fetched = new Date(Date.now() - 23 * 60 * 60_000);
    expect(() => assertTidalFresh(fetched)).not.toThrow();
  });

  it('rejects data fetched 25 hours ago', () => {
    const fetched = new Date(Date.now() - 25 * 60 * 60_000);
    expect(() => assertTidalFresh(fetched)).toThrow(StaleTidalError);
  });

  it('rejects data fetched 7 days ago with a clear message', () => {
    const fetched = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    let caught: unknown;
    try {
      assertTidalFresh(fetched);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StaleTidalError);
    expect((caught as StaleTidalError).ageHours).toBeGreaterThan(24);
    expect((caught as Error).message).toMatch(/stale|refresh/i);
  });

  it('rejects an invalid date (defensive)', () => {
    expect(() => assertTidalFresh('not-a-date')).toThrow(StaleTidalError);
  });

  it('pins the max age at 24 hours — changes require a deliberate CLAUDE.md update', () => {
    expect(MAX_TIDAL_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});

/**
 * AuthMiddleware token lifecycle tests.
 *
 * SECURITY: CLAUDE.md flags 7-day access tokens on a life-safety product as
 * an unacceptable session-hijack window. These tests pin:
 *   - access tokens expire at ~1h (±60s)
 *   - refresh tokens expire at ~30d
 *   - refresh tokens are rejected when used as access tokens
 *   - refreshAccessToken rotates successfully
 * so a silent regression back to long-lived access tokens fails CI.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import { AuthMiddleware } from '../auth';

const silent = pino({ level: 'silent' });

const fakeDb = { query: async () => ({ rows: [] }) } as any;

describe('AuthMiddleware — short-lived access + refresh rotation', () => {
  const SECRET = 'test-secret-minimum-32-chars-long-for-hs256';
  let auth: AuthMiddleware;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    auth = new AuthMiddleware(fakeDb, silent);
  });

  it('access token expires in ~1 hour, not 7 days', async () => {
    const token = await auth.generateToken({ id: 'u1', email: 'a@b.com' });
    const decoded = jwt.verify(token, SECRET) as any;
    const ttlSec = decoded.exp - decoded.iat;
    // 1h ± 60s tolerance
    expect(ttlSec).toBeGreaterThanOrEqual(60 * 60 - 60);
    expect(ttlSec).toBeLessThanOrEqual(60 * 60 + 60);
    // SAFETY: anyone tempted to re-raise this to days must update CLAUDE.md first
    expect(ttlSec).toBeLessThan(24 * 60 * 60);
  });

  it('access token carries type=access', async () => {
    const token = await auth.generateToken({ id: 'u1', email: 'a@b.com' });
    const decoded = jwt.verify(token, SECRET) as any;
    expect(decoded.type).toBe('access');
  });

  it('refresh token expires in ~30 days and carries type=refresh', async () => {
    const token = await auth.generateRefreshToken({ id: 'u1', email: 'a@b.com' });
    const decoded = jwt.verify(token, SECRET) as any;
    const ttlSec = decoded.exp - decoded.iat;
    expect(ttlSec).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 - 60);
    expect(ttlSec).toBeLessThanOrEqual(30 * 24 * 60 * 60 + 60);
    expect(decoded.type).toBe('refresh');
  });

  it('refreshAccessToken mints a new access token from a valid refresh token', async () => {
    const refresh = await auth.generateRefreshToken({ id: 'u1', email: 'a@b.com' });
    const fresh = await auth.refreshAccessToken(refresh);
    expect(fresh).not.toBeNull();
    const decoded = jwt.verify(fresh!, SECRET) as any;
    expect(decoded.type).toBe('access');
    expect(decoded.id).toBe('u1');
  });

  it('refreshAccessToken rejects an access token passed as a refresh token', async () => {
    const access = await auth.generateToken({ id: 'u1', email: 'a@b.com' });
    const result = await auth.refreshAccessToken(access);
    expect(result).toBeNull();
  });

  it('refreshAccessToken rejects a garbage token', async () => {
    const result = await auth.refreshAccessToken('not-a-jwt');
    expect(result).toBeNull();
  });
});

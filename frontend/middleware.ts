/**
 * CSRF Protection Middleware
 *
 * Implements multiple layers of CSRF protection:
 * 1. Origin/Referer header validation
 * 2. Double-submit cookie pattern
 *
 * This middleware runs on all API routes to protect against CSRF attacks.
 */

import { NextRequest, NextResponse } from 'next/server';

// Methods that require CSRF protection (state-changing operations)
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Cookie and header names
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Token validity duration (24 hours in milliseconds)
const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000;

// Allowed origins for CSRF validation
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // Production origin
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  // Vercel preview deployments
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  // Development
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000');
    origins.push('http://localhost:3001');
    origins.push('http://127.0.0.1:3000');
  }

  return origins;
};

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken(): string {
  // Use crypto API for secure random values
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const timestamp = Date.now().toString(36);
  return `${token}.${timestamp}`;
}

/**
 * Validate CSRF token format and freshness
 */
function isValidToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [, timestampStr] = parts;
  const timestamp = parseInt(timestampStr, 36);

  if (isNaN(timestamp)) {
    return false;
  }

  // Check if token is not expired
  const now = Date.now();
  return now - timestamp < TOKEN_VALIDITY_MS;
}

/**
 * Validate origin/referer against allowed origins
 */
function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigins = getAllowedOrigins();

  // In production, require a valid origin
  if (process.env.NODE_ENV === 'production') {
    if (!origin && !referer) {
      return false;
    }
  }

  // Check origin header
  if (origin) {
    return allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed));
  }

  // Fall back to referer if origin is not present
  if (referer) {
    return allowedOrigins.some((allowed) => referer.startsWith(allowed));
  }

  // Allow in development without origin/referer (for tools like Postman)
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if the request path is exempt from CSRF protection
 */
function isExemptPath(pathname: string): boolean {
  // Webhook endpoints are exempt (they use their own signature validation)
  const exemptPaths = [
    '/api/stripe/webhook',
    '/api/webhooks/',
  ];

  return exemptPaths.some((exempt) => pathname.startsWith(exempt));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply CSRF protection to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip CSRF for exempt paths (webhooks, etc.)
  if (isExemptPath(pathname)) {
    return NextResponse.next();
  }

  // GET, HEAD, OPTIONS are safe methods - no CSRF check needed
  if (!PROTECTED_METHODS.includes(request.method)) {
    // For GET requests, set a CSRF token cookie if not present
    const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

    if (!existingToken || !isValidToken(existingToken)) {
      const response = NextResponse.next();
      const newToken = generateCsrfToken();

      response.cookies.set(CSRF_COOKIE_NAME, newToken, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_VALIDITY_MS / 1000,
      });

      return response;
    }

    return NextResponse.next();
  }

  // For state-changing methods, validate CSRF protection

  // 1. Validate origin/referer
  if (!validateOrigin(request)) {
    console.warn('CSRF: Origin validation failed', {
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      path: pathname,
    });

    return NextResponse.json(
      { error: 'CSRF validation failed: Invalid origin' },
      { status: 403 }
    );
  }

  // 2. Double-submit cookie validation
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  // Check if both tokens are present
  if (!cookieToken || !headerToken) {
    console.warn('CSRF: Missing token', {
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      path: pathname,
    });

    return NextResponse.json(
      { error: 'CSRF validation failed: Missing token' },
      { status: 403 }
    );
  }

  // Check if tokens match
  if (cookieToken !== headerToken) {
    console.warn('CSRF: Token mismatch', {
      path: pathname,
    });

    return NextResponse.json(
      { error: 'CSRF validation failed: Token mismatch' },
      { status: 403 }
    );
  }

  // Check if token is valid (proper format and not expired)
  if (!isValidToken(cookieToken)) {
    console.warn('CSRF: Invalid or expired token', {
      path: pathname,
    });

    return NextResponse.json(
      { error: 'CSRF validation failed: Invalid or expired token' },
      { status: 403 }
    );
  }

  // CSRF validation passed
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes except static files
    '/api/:path*',
  ],
};

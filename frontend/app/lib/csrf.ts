/**
 * CSRF Token Utilities
 *
 * Provides functions to get and use CSRF tokens for protected API requests.
 * Works with the CSRF middleware to implement double-submit cookie pattern.
 */

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Get the current CSRF token from cookies
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Add CSRF token to request headers
 * Use this when making POST, PUT, PATCH, DELETE requests
 */
export function addCsrfHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCsrfToken();
  if (!token) {
    console.warn('CSRF token not found. Ensure you have made a GET request first.');
    return headers;
  }

  if (headers instanceof Headers) {
    headers.set(CSRF_HEADER_NAME, token);
    return headers;
  }

  if (Array.isArray(headers)) {
    return [...headers, [CSRF_HEADER_NAME, token]];
  }

  return {
    ...headers,
    [CSRF_HEADER_NAME]: token,
  };
}

/**
 * Create a fetch wrapper that automatically includes CSRF token
 * for state-changing requests (POST, PUT, PATCH, DELETE)
 */
export async function csrfFetch(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (needsCsrf) {
    options.headers = addCsrfHeader(options.headers || {});
  }

  // Ensure credentials are included so cookies are sent
  options.credentials = options.credentials || 'same-origin';

  return fetch(url, options);
}

/**
 * Initialize CSRF protection by making an initial GET request
 * This should be called early in the app lifecycle to ensure
 * the CSRF cookie is set before any state-changing requests
 */
export async function initializeCsrf(): Promise<void> {
  // Make a lightweight GET request to any API endpoint to receive the CSRF cookie
  try {
    await fetch('/api/passages/recent', {
      method: 'GET',
      credentials: 'same-origin',
    });
  } catch {
    // Silently fail - CSRF token will be set on first successful API request
  }
}

export { CSRF_HEADER_NAME };

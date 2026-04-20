/**
 * OAuth Callback Handler
 * Handles authentication callbacks from OAuth providers (Google, GitHub)
 *
 * Uses @supabase/ssr (replaces deprecated @supabase/auth-helpers-nextjs)
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { serverLogger } from "../../lib/server-logger";

// CRITICAL: Cloudflare Pages requires Edge Runtime for dynamic routes
export const runtime = "edge";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const error_description = requestUrl.searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    serverLogger.error("OAuth callback error", { error, error_description });
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=${encodeURIComponent(error_description || error)}`,
    );
  }

  if (code) {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            },
          },
        },
      );

      // Exchange code for session
      const { error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        serverLogger.error("Session exchange error", {
          error: sessionError.message,
        });
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=${encodeURIComponent(sessionError.message)}`,
        );
      }

      // Successful authentication - redirect to dashboard
      return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
    } catch (error: any) {
      serverLogger.error("Auth callback error", { error: String(error) });
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`,
      );
    }
  }

  // No code or error, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login`);
}

/**
 * OAuth Callback Handler
 * Handles authentication callbacks from OAuth providers (Google, GitHub)
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth callback error:', error, error_description);
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=${encodeURIComponent(error_description || error)}`
    );
  }

  if (code) {
    try {
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      
      // Exchange code for session
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (sessionError) {
        console.error('Session exchange error:', sessionError);
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=${encodeURIComponent(sessionError.message)}`
        );
      }

      // Successful authentication - redirect to dashboard
      console.log('OAuth authentication successful');
      return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
      
    } catch (error: any) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`
      );
    }
  }

  // No code or error, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login`);
}


export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();

    const {
      feedback_type,
      feedback_text,
      contact_email,
      pageUrl,
      userAgent,
      browserInfo,
    } = body;

    // Validate required fields
    if (!feedback_type || !feedback_text) {
      return NextResponse.json(
        { error: 'Feedback type and text are required' },
        { status: 400 }
      );
    }

    // Get user ID from auth header if available
    const authHeader = request.headers.get('authorization');
    let userId = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // Insert feedback
    const { data, error } = await supabase
      .from('user_feedback')
      .insert({
        user_id: userId,
        feedback_type,
        feedback_text,
        page_url: pageUrl,
        user_agent: userAgent,
        contact_email: contact_email || null,
        browser_info: browserInfo || null,
        status: 'new',
      } as any)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to insert feedback:', error);
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }

    // TODO: Send notification to admin (email, Slack, etc.)
    // For now, just log
    const feedbackData = data as any;
    console.log('New feedback received:', {
      id: feedbackData.id,
      type: feedback_type,
      userId,
    });

    return NextResponse.json({
      success: true,
      feedbackId: feedbackData.id,
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


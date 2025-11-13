import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create a safe Supabase client that handles missing config
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Return null if Supabase is not configured
  if (!supabaseUrl || supabaseUrl === 'NA' || !supabaseKey || supabaseKey === 'NA') {
    return null
  }

  try {
    return createSupabaseClient(supabaseUrl, supabaseKey)
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    return null
  }
}

// Singleton instance
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null

export function getSupabase() {
  if (supabaseInstance === null) {
    supabaseInstance = createClient() as any
  }
  return supabaseInstance
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(supabaseUrl && supabaseUrl !== 'NA' && supabaseKey && supabaseKey !== 'NA')
}


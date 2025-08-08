'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient, User, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { config } from '../config'
import { toast } from '../hooks/use-toast'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateProfile: (data: any) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Initialize Supabase client
const supabase = createClient(
  config.auth.supabaseUrl || '',
  config.auth.supabaseAnonKey || ''
)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        if (event === 'SIGNED_IN') {
          // Check if user needs onboarding (e.g., no boat profiles)
          const { data: boats } = await supabase
            .from('boat_profiles')
            .select('id')
            .eq('user_id', session?.user?.id)
            .limit(1)
          
          if (!boats || boats.length === 0) {
            router.push('/onboarding')
          } else {
            router.push('/dashboard')
          }
        } else if (event === 'SIGNED_OUT') {
          router.push('/')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            subscription_tier: 'free',
            signup_source: 'web',
          }
        }
      })

      if (error) throw error

      toast.success('Account created!', {
        description: 'Please check your email to verify your account.',
      })

      // Create user profile
      if (data.user) {
        await fetch('/api/users/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            email: data.user.email,
          }),
        })
      }
    } catch (error: any) {
      toast.error('Signup failed', { description: error.message })
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast.success('Welcome back!', { description: 'You have successfully signed in.' })
    } catch (error: any) {
      toast.error('Login failed', { description: error.message })
      throw error
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      toast('Signed out', { description: 'You have been signed out successfully.' })
    } catch (error: any) {
      toast.error('Error signing out', { description: error.message })
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      toast.success('Password reset email sent', { description: 'Check your email for the password reset link.' })
    } catch (error: any) {
      toast.error('Password reset failed', { description: error.message })
      throw error
    }
  }

  const updateProfile = async (data: any) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data,
      })

      if (error) throw error

      toast.success('Profile updated', { description: 'Your profile has been updated successfully.' })
    } catch (error: any) {
      toast.error('Update failed', { description: error.message })
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 
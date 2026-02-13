'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Anchor, Mail, Lock, Eye, EyeOff, AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase-client'

// Email validation helper
function validateEmail(email: string): string | null {
  if (!email || email.trim() === '') {
    return 'Email is required'
  }
  // RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address'
  }
  return null
}

// Password validation helper
function validatePassword(password: string): string | null {
  if (!password || password.trim() === '') {
    return 'Password is required'
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters'
  }
  return null
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const { signIn } = useAuth()
  const router = useRouter()
  const supabase = getSupabase()
  const supabaseConfigured = isSupabaseConfigured()

  // Handle OAuth callback errors and demo param using window.location
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const callbackError = params.get('error')
      if (callbackError) {
        setError(decodeURIComponent(callbackError))
        toast.error('Authentication failed', { description: callbackError })
      }

      // Auto-trigger demo mode if ?demo=true is in URL
      const demoParam = params.get('demo')
      if (demoParam === 'true') {
        localStorage.setItem('helmwise_demo_mode', 'true')
        toast.success('Demo mode activated', { description: 'Exploring Helmwise as a demo user' })
        router.push('/dashboard')
      }
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors
    setError(null)
    setEmailError(null)
    setPasswordError(null)

    // Validate inputs
    const emailValidation = validateEmail(email)
    const passwordValidation = validatePassword(password)

    if (emailValidation) {
      setEmailError(emailValidation)
      return
    }

    if (passwordValidation) {
      setPasswordError(passwordValidation)
      return
    }

    setLoading(true)

    try {
      await signIn(email, password)
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Login error:', error)
      setError(error.message || 'Failed to sign in. Please check your credentials.')
      toast.error('Login failed', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = () => {
    // Store demo mode in localStorage and redirect to dashboard
    if (typeof window !== 'undefined') {
      localStorage.setItem('helmwise_demo_mode', 'true')
      toast.success('Demo mode activated', { description: 'Exploring Helmwise as a demo user' })
      router.push('/dashboard')
    }
  }

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      toast.error('Authentication not available')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('Google OAuth error:', error)
        throw error
      }
    } catch (error: any) {
      setError('Failed to sign in with Google. Please try again.')
      toast.error('Google Sign-In failed', { description: error.message })
      setLoading(false)
    }
  }

  const handleGitHubSignIn = async () => {
    if (!supabase) {
      toast.error('Authentication not available')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'read:user user:email',
        },
      })

      if (error) {
        console.error('GitHub OAuth error:', error)
        throw error
      }
    } catch (error: any) {
      setError('Failed to sign in with GitHub. Please try again.')
      toast.error('GitHub Sign-In failed', { description: error.message })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 section-ocean relative overflow-hidden">
        <div className="absolute inset-0 chart-grid opacity-10" />

        {/* Decorative compass */}
        <svg
          viewBox="0 0 200 200"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] text-white opacity-[0.08] -mr-32 animate-compass-needle"
          fill="none"
        >
          <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.5" />
          <path d="M100 5 L103 40 L100 35 L97 40 Z" fill="currentColor" />
          <path d="M100 195 L103 160 L100 165 L97 160 Z" fill="currentColor" opacity="0.5" />
          <path d="M5 100 L40 103 L35 100 L40 97 Z" fill="currentColor" opacity="0.5" />
          <path d="M195 100 L160 103 L165 100 L160 97 Z" fill="currentColor" opacity="0.5" />
          <circle cx="100" cy="100" r="5" fill="currentColor" />
        </svg>

        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-16">
          <Link href="/" className="inline-flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur">
              <Anchor className="h-6 w-6 text-white" />
            </div>
            <span className="font-display text-2xl font-bold text-white">Helmwise</span>
          </Link>

          <h2 className="font-display text-4xl lg:text-5xl text-white leading-tight mb-6">
            Navigate with<br />
            <span className="text-brass-300">Confidence</span>
          </h2>

          <p className="text-lg text-white/80 max-w-md">
            AI-powered passage planning with real-time weather, tidal predictions, and comprehensive safety analysis.
          </p>

          <div className="mt-12 space-y-4">
            {[
              'Real-time weather routing',
              'Tidal predictions',
              '6 specialized AI agents',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/90">
                <div className="w-2 h-2 rounded-full bg-brass-400" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-ocean-deep flex items-center justify-center">
                <Anchor className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold">Helmwise</span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          {/* Login Card */}
          <div className="card p-8">
            {!supabaseConfigured && (
              <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Demo Mode Available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Authentication is not configured. Use Demo Mode to explore.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div data-testid="login-error" className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    data-testid="login-email"
                    type="email"
                    placeholder="captain@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError(null)
                    }}
                    className={`pl-10 h-12 ${emailError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? 'email-error' : undefined}
                  />
                </div>
                {emailError && (
                  <p id="email-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/reset-password" data-testid="login-forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    data-testid="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (passwordError) setPasswordError(null)
                    }}
                    className={`pl-10 pr-10 h-12 ${passwordError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p id="password-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {passwordError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                data-testid="login-submit"
                fullWidth
                disabled={loading || !supabaseConfigured}
                className="btn-primary h-12"
              >
                {loading ? (
                  <span className="flex items-center">
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            {/* Demo Mode Button */}
            <div className="mt-4">
              <Button
                type="button"
                data-testid="login-demo"
                variant="outline"
                fullWidth
                onClick={handleDemoLogin}
                className="h-12 group"
              >
                <span>Try Demo Mode</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>

            {supabaseConfigured && (
              <>
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-card text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      data-testid="login-google"
                      variant="outline"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="h-11"
                    >
                      <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </Button>
                    <Button
                      type="button"
                      data-testid="login-github"
                      variant="outline"
                      onClick={handleGitHubSignIn}
                      disabled={loading}
                      className="h-11"
                    >
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      GitHub
                    </Button>
                  </div>
                </div>
              </>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/signup" data-testid="login-signup-link" className="text-primary hover:underline font-medium">
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

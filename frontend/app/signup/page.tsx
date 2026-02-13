
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Anchor, Mail, Lock, User, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { analytics } from '../lib/analytics'
import { isSupabaseConfigured } from '../lib/supabase-client'

const passwordRequirements = [
  { regex: /.{8,}/, text: 'At least 8 characters' },
  { regex: /[A-Z]/, text: 'One uppercase letter' },
  { regex: /[a-z]/, text: 'One lowercase letter' },
  { regex: /[0-9]/, text: 'One number' },
]

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const router = useRouter()
  const supabaseConfigured = isSupabaseConfigured()

  const passwordStrength = passwordRequirements.filter(req => 
    req.regex.test(formData.password)
  ).length

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match')
      return
    }

    if (!agreedToTerms) {
      alert('Please agree to the terms and conditions')
      return
    }

    setLoading(true)

    try {
      await signUp(formData.email, formData.password)
      
      // Track successful signup
      analytics.track('user_signed_up', {
        method: 'email',
        has_name: !!formData.name,
      });
      
      // Redirect handled by AuthContext
    } catch (error: any) {
      console.error('Signup error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center">
            <Anchor className="h-12 w-12 text-primary animate-float" />
          </Link>
          <h1 className="text-3xl font-bold mt-4 mb-2">Create Your Account</h1>
          <p className="text-muted-foreground">
            Start planning your passages with AI assistance
          </p>
        </div>

        {/* Signup Form */}
        <div className="glass rounded-lg p-8">
          {!supabaseConfigured && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 text-sm font-medium">Authentication not configured</p>
                <p className="text-amber-700 text-xs mt-1">
                  Supabase environment variables are not set. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
                </p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="name"
                  data-testid="signup-name"
                  name="name"
                  type="text"
                  placeholder="Captain Jack Sparrow"
                  value={formData.name}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  data-testid="signup-email"
                  name="email"
                  type="email"
                  placeholder="captain@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  data-testid="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div data-testid="signup-password-strength" className="space-y-2 mt-2">
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          i < passwordStrength
                            ? passwordStrength <= 2 
                              ? 'bg-amber-500' 
                              : 'bg-green-500'
                            : 'bg-gray-200 dark:bg-gray-700'
                        )}
                      />
                    ))}
                  </div>
                  <div className="space-y-1">
                    {passwordRequirements.map((req, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center gap-2 text-xs transition-colors',
                          req.regex.test(formData.password)
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                        )}
                      >
                        <Check className={cn(
                          'h-3 w-3',
                          req.regex.test(formData.password) ? 'opacity-100' : 'opacity-0'
                        )} />
                        {req.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  data-testid="signup-confirm-password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                data-testid="signup-terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              />
              <label
                htmlFor="terms"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                I agree to the{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <Button
              type="submit"
              data-testid="signup-submit"
              fullWidth
              disabled={loading || !agreedToTerms || passwordStrength < 4}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" data-testid="signup-login-link" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span>Start with 2 free passages per month</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span>14-day free trial of Premium features</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span>No credit card required</span>
          </div>
        </div>
      </div>
    </div>
  )
} 
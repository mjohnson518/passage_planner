export const dynamic = 'force-dynamic'

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { useToast } from '../hooks/use-toast'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { resetPassword } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    
    try {
      await resetPassword(email)
      setIsSuccess(true)
      toast({
        title: 'Check your email',
        description: 'We sent you a password reset link',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reset email',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsLoading(true)
    try {
      await resetPassword(email)
      toast({
        title: 'Email resent',
        description: 'Check your inbox for the reset link',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend email',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            {isSuccess 
              ? 'Check your email for the reset link'
              : 'Enter your email to receive a password reset link'
            }
          </CardDescription>
        </CardHeader>
        
        {!isSuccess ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              
              <div className="text-sm text-center">
                Remember your password?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Back to login
                </Link>
              </div>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
            </div>
            
            <p className="text-center text-sm text-muted-foreground">
              We&apos;ve sent a password reset link to <strong>{email}</strong>
            </p>
            
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={isLoading}
              >
                Resend
              </Button>
            </div>
            
            <Link href="/login" className="block">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  )
} 
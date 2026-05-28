"use client";

import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  supabaseConfigured: boolean;
  emailError: string | null;
  passwordError: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function LoginForm({
  email,
  password,
  showPassword,
  loading,
  supabaseConfigured,
  emailError,
  passwordError,
  onEmailChange,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
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
            onChange={(e) => onEmailChange(e.target.value)}
            className={`pl-10 h-12 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
          />
        </div>
        {emailError && (
          <p
            id="email-error"
            className="text-sm text-destructive flex items-center gap-1"
          >
            <AlertTriangle className="h-3 w-3" />
            {emailError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/reset-password"
            data-testid="login-forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="password"
            data-testid="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={`pl-10 pr-10 h-12 ${passwordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={onToggleShowPassword}
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
          <p
            id="password-error"
            className="text-sm text-destructive flex items-center gap-1"
          >
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
        className="btn-brass h-12"
      >
        {loading ? (
          <span className="flex items-center">
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
            Signing in…
          </span>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  );
}

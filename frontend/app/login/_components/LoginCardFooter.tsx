"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginSocialButtons } from "./LoginSocialButtons";

interface LoginCardFooterProps {
  loading: boolean;
  supabaseConfigured: boolean;
  onDemoLogin: () => void;
  onGoogle: () => void;
  onGitHub: () => void;
}

export function LoginCardFooter({
  loading,
  supabaseConfigured,
  onDemoLogin,
  onGoogle,
  onGitHub,
}: LoginCardFooterProps) {
  return (
    <>
      {/* Demo Mode Button */}
      <div className="mt-4">
        <Button
          type="button"
          data-testid="login-demo"
          variant="outline"
          fullWidth
          onClick={onDemoLogin}
          className="h-12 group"
        >
          <span>Try Demo Mode</span>
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>

      {supabaseConfigured && (
        <LoginSocialButtons
          loading={loading}
          onGoogle={onGoogle}
          onGitHub={onGitHub}
        />
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          data-testid="login-signup-link"
          className="text-primary hover:underline font-medium"
        >
          Sign up for free
        </Link>
      </p>
    </>
  );
}

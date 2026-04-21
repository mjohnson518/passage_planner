"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Anchor, ArrowLeft, Mail } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { resetPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Invalid email", {
        description: "Please enter a valid email address",
      });
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(email);
      setIsSuccess(true);
      toast.success("Check your email", {
        description: "We sent you a password reset link",
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to send reset email",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await resetPassword(email);
      toast.success("Email resent", {
        description: "Check your inbox for the reset link",
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to resend email",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="section-hero relative min-h-screen flex items-center justify-center px-4 py-12">
      <div
        className="absolute inset-0 chart-grid opacity-20 pointer-events-none"
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Anchor className="h-6 w-6 text-primary" />
            </div>
            <span className="font-display text-2xl font-bold">Helmwise</span>
          </Link>
          <h1 className="font-display text-3xl font-bold mt-6 mb-2">
            Reset <span className="text-gradient">Password</span>
          </h1>
          <p className="text-muted-foreground">
            {isSuccess
              ? "Check your email for the reset link"
              : "Enter your email to receive a password reset link"}
          </p>
        </div>

        {/* Form Card */}
        <div className="card-nautical p-8">
          {!isSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="captain@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                fullWidth
                disabled={isLoading}
                className="btn-brass h-12"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Sending...
                  </span>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <p className="text-sm text-center text-muted-foreground pt-2">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="text-primary hover:underline font-medium"
                >
                  Back to login
                </Link>
              </p>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-success/10 p-4">
                  <Mail className="h-8 w-8 text-success" />
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                We&apos;ve sent a password reset link to{" "}
                <strong className="text-foreground">{email}</strong>
              </p>

              <div className="space-y-3">
                <p className="text-center text-sm text-muted-foreground">
                  Didn&apos;t receive the email? Check your spam folder or
                </p>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleResend}
                  disabled={isLoading}
                  className="h-11"
                >
                  {isLoading ? "Resending..." : "Resend"}
                </Button>
              </div>

              <Link href="/login" className="block">
                <Button variant="ghost" fullWidth className="h-11">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

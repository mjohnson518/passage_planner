"use client";

import { useReducer, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase-client";
import { logger } from "../lib/logger";
import { AuthBrandColumn } from "../components/auth/AuthBrandColumn";
import { AuthMobileLogo } from "./_components/AuthMobileLogo";
import { LoginHeader } from "./_components/LoginHeader";
import { LoginAlerts } from "./_components/LoginAlerts";
import { LoginForm } from "./_components/LoginForm";
import { LoginCardFooter } from "./_components/LoginCardFooter";

// Email validation helper
function validateEmail(email: string): string | null {
  if (!email || email.trim() === "") {
    return "Email is required";
  }
  // RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return null;
}

// Password validation helper
function validatePassword(password: string): string | null {
  if (!password || password.trim() === "") {
    return "Password is required";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }
  return null;
}

// Consolidated form-error state (replaces the previous three separate
// useState hooks for the form-level error and the per-field errors).
interface ErrorsState {
  form: string | null;
  email: string | null;
  password: string | null;
}

type ErrorsAction =
  | { type: "clearAll" }
  | { type: "setForm"; value: string | null }
  | { type: "setEmail"; value: string | null }
  | { type: "setPassword"; value: string | null };

const initialErrors: ErrorsState = {
  form: null,
  email: null,
  password: null,
};

function errorsReducer(state: ErrorsState, action: ErrorsAction): ErrorsState {
  switch (action.type) {
    case "clearAll":
      return { form: null, email: null, password: null };
    case "setForm":
      return { ...state, form: action.value };
    case "setEmail":
      return { ...state, email: action.value };
    case "setPassword":
      return { ...state, password: action.value };
    default:
      return state;
  }
}

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, dispatchErrors] = useReducer(errorsReducer, initialErrors);
  const { signIn } = useAuth();
  const { push } = useRouter();
  const supabase = getSupabase();
  const supabaseConfigured = isSupabaseConfigured();

  // Handle OAuth callback errors and demo param using window.location
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const callbackError = params.get("error");
      if (callbackError) {
        dispatchErrors({
          type: "setForm",
          value: decodeURIComponent(callbackError),
        });
        toast.error("Authentication failed", { description: callbackError });
      }

      // Auto-trigger demo mode if ?demo=true is in URL
      const demoParam = params.get("demo");
      if (demoParam === "true") {
        localStorage.setItem("helmwise_demo_mode", "true");
        toast.success("Demo mode activated", {
          description: "Exploring Helmwise as a demo user",
        });
        push("/dashboard");
      }
    }
  }, [push]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    dispatchErrors({ type: "clearAll" });

    // Validate inputs
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    if (emailValidation) {
      dispatchErrors({ type: "setEmail", value: emailValidation });
      return;
    }

    if (passwordValidation) {
      dispatchErrors({ type: "setPassword", value: passwordValidation });
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
      push("/dashboard");
    } catch (error: any) {
      logger.error("login failed", {
        code: error?.code,
        status: error?.status,
      });
      dispatchErrors({
        type: "setForm",
        value:
          error.message || "Failed to sign in. Please check your credentials.",
      });
      toast.error("Login failed", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // Store demo mode in localStorage and redirect to dashboard
    if (typeof window !== "undefined") {
      localStorage.setItem("helmwise_demo_mode", "true");
      toast.success("Demo mode activated", {
        description: "Exploring Helmwise as a demo user",
      });
      push("/dashboard");
    }
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      toast.error("Authentication not available");
      return;
    }

    setLoading(true);
    dispatchErrors({ type: "setForm", value: null });

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        logger.error("google oauth failed", { code: (error as any)?.code });
        throw error;
      }
    } catch (error: any) {
      dispatchErrors({
        type: "setForm",
        value: "Failed to sign in with Google. Please try again.",
      });
      toast.error("Google Sign-In failed", { description: error.message });
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    if (!supabase) {
      toast.error("Authentication not available");
      return;
    }

    setLoading(true);
    dispatchErrors({ type: "setForm", value: null });

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "read:user user:email",
        },
      });

      if (error) {
        logger.error("github oauth failed", { code: (error as any)?.code });
        throw error;
      }
    } catch (error: any) {
      dispatchErrors({
        type: "setForm",
        value: "Failed to sign in with GitHub. Please try again.",
      });
      toast.error("GitHub Sign-In failed", { description: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <AuthBrandColumn />

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <AuthMobileLogo />

          <LoginHeader />

          {/* Login Card */}
          <div className="card-nautical p-8">
            <LoginAlerts
              supabaseConfigured={supabaseConfigured}
              formError={errors.form}
            />

            <LoginForm
              email={email}
              password={password}
              showPassword={showPassword}
              loading={loading}
              supabaseConfigured={supabaseConfigured}
              emailError={errors.email}
              passwordError={errors.password}
              onEmailChange={(value) => {
                setEmail(value);
                if (errors.email)
                  dispatchErrors({ type: "setEmail", value: null });
              }}
              onPasswordChange={(value) => {
                setPassword(value);
                if (errors.password)
                  dispatchErrors({ type: "setPassword", value: null });
              }}
              onToggleShowPassword={() => setShowPassword(!showPassword)}
              onSubmit={handleSubmit}
            />

            <LoginCardFooter
              loading={loading}
              supabaseConfigured={supabaseConfigured}
              onDemoLogin={handleDemoLogin}
              onGoogle={handleGoogleSignIn}
              onGitHub={handleGitHubSignIn}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

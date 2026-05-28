"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { config } from "../config";
import { toast } from "sonner";
import { getSupabase } from "../lib/supabase-client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

type AuthAction =
  | { type: "sessionResolved"; session: Session | null }
  | { type: "loadingDone" };

const INITIAL_AUTH_STATE: AuthState = {
  user: null,
  session: null,
  loading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "sessionResolved":
      return {
        user: action.session?.user ?? null,
        session: action.session,
        loading: false,
      };
    case "loadingDone":
      return { ...state, loading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ user, session, loading }, dispatch] = useReducer(
    authReducer,
    INITIAL_AUTH_STATE,
  );
  const { push } = useRouter();

  // Lazy load Supabase client
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase) {
      dispatch({ type: "loadingDone" });
      return;
    }

    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch({ type: "sessionResolved", session });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      dispatch({ type: "sessionResolved", session });

      if (event === "SIGNED_IN" && session?.user?.id) {
        // Check if user needs onboarding (e.g., no boat profiles)
        const { data: boats } = await supabase
          .from("boat_profiles")
          .select("id")
          .eq("user_id", session.user.id)
          .limit(1);

        if (!boats || boats.length === 0) {
          push("/onboarding");
        } else {
          push("/dashboard");
        }
      } else if (event === "SIGNED_OUT") {
        push("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [push, supabase]);

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        toast.error("Authentication not available");
        return;
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              subscription_tier: "free",
              signup_source: "web",
            },
          },
        });

        if (error) throw error;

        toast.success("Account created!", {
          description: "Please check your email to verify your account.",
        });

        // Create user profile
        if (data.user) {
          await fetch("/api/users/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: data.user.id,
              email: data.user.email,
            }),
          });
        }
      } catch (error: any) {
        toast.error("Signup failed", { description: error.message });
        throw error;
      }
    },
    [supabase],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        toast.error("Authentication not available", {
          description: "Please configure Supabase environment variables.",
        });
        throw new Error(
          "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
      }

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success("Welcome back!", {
          description: "You have successfully signed in.",
        });
      } catch (error: any) {
        toast.error("Login failed", { description: error.message });
        throw error;
      }
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      toast.error("Authentication not available");
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast("Signed out", {
        description: "You have been signed out successfully.",
      });
    } catch (error: any) {
      toast.error("Error signing out", { description: error.message });
    }
  }, [supabase]);

  const resetPassword = useCallback(
    async (email: string) => {
      if (!supabase) {
        toast.error("Authentication not available");
        return;
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;

        toast.success("Password reset email sent", {
          description: "Check your email for the password reset link.",
        });
      } catch (error: any) {
        toast.error("Password reset failed", { description: error.message });
        throw error;
      }
    },
    [supabase],
  );

  const updateProfile = useCallback(
    async (data: any) => {
      if (!supabase) {
        toast.error("Authentication not available");
        return;
      }

      try {
        const { error } = await supabase.auth.updateUser({
          data,
        });

        if (error) throw error;

        toast.success("Profile updated", {
          description: "Your profile has been updated successfully.",
        });
      } catch (error: any) {
        toast.error("Update failed", { description: error.message });
        throw error;
      }
    },
    [supabase],
  );

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
    }),
    [
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign In | Helmwise",
  description:
    "Sign in to your Helmwise account to access AI-powered maritime passage planning, weather routing, and safety tools.",
};

export default function Page() {
  return <LoginClient />;
}

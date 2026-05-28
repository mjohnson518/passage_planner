import type { Metadata } from "next";
import SignupClient from "./SignupClient";

export const metadata: Metadata = {
  title: "Create Account | Helmwise",
  description:
    "Create a free Helmwise account to start planning safe maritime passages with AI-powered weather, tidal, and safety analysis.",
};

export default function Page() {
  return <SignupClient />;
}

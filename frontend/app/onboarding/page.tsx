import type { Metadata } from "next";
import OnboardingClient from "./OnboardingClient";

export const metadata: Metadata = {
  title: "Get Started | Helmwise",
  description:
    "Set up your vessel profile and preferences to start planning safe maritime passages with Helmwise.",
};

export default function Page() {
  return <OnboardingClient />;
}

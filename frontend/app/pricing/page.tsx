import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing | Helmwise",
  description:
    "Compare Helmwise plans — from free passage planning to Premium weather routing and Pro fleet management. Choose the plan that fits your sailing.",
};

export default function Page() {
  return <PricingClient />;
}

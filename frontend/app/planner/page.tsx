import type { Metadata } from "next";
import PlannerClient from "./PlannerClient";

export const metadata: Metadata = {
  title: "Plan New Passage — Helmwise",
  description:
    "Plan a sailing passage with route calculations, weather, tidal predictions, navigation warnings, safety analysis, and port information.",
};

export default function PlannerPage() {
  return <PlannerClient />;
}

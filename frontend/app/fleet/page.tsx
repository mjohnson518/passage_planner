import type { Metadata } from "next";
import FleetPageClient from "./FleetPageClient";

export const metadata: Metadata = {
  title: "Fleet",
  description:
    "Coordinate multiple vessels and crew — add boats, invite members, share passage plans, and review fleet analytics.",
};

export default function FleetPage() {
  return <FleetPageClient />;
}

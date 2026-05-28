export const runtime = "edge";

import type { Metadata } from "next";
import PassageDetailClient from "./PassageDetailClient";
import RequireAuth from "../../components/auth/RequireAuth";

export const metadata: Metadata = {
  title: "Passage Detail",
  description:
    "Review the route, weather, tides, and safety information for a planned passage.",
};

export default function PassageDetailPage() {
  return (
    <RequireAuth>
      <PassageDetailClient />
    </RequireAuth>
  );
}

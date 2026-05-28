import type { Metadata } from "next";
import LogbookPageClient from "./LogbookPageClient";

export const metadata: Metadata = {
  title: "Logbook",
  description:
    "Append-only ship's logbook for this passage — record positions, watch handovers, weather, and events, and export the log as a PDF.",
};

export default function LogbookPage() {
  return <LogbookPageClient />;
}

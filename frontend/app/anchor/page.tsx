import type { Metadata } from "next";
import AnchorWatchPageClient from "./AnchorWatchPageClient";

export const metadata: Metadata = {
  title: "Anchor watch",
  description:
    "Set a GPS swing circle at your anchor drop point and get an accuracy-aware drag alarm if your boat leaves it. Free anchor-watch tool for mariners.",
};

export default function Page() {
  return <AnchorWatchPageClient />;
}

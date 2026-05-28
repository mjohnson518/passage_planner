import type { Metadata } from "next";
import AnchoragesPageClient from "./AnchoragesPageClient";

export const metadata: Metadata = {
  title: "Anchorages",
  description:
    "Browse cruiser-contributed anchorages: depths, holding, shelter directions, and notes from sailors who have been there. Search by name or find anchorages near you.",
};

export default function Page() {
  return <AnchoragesPageClient />;
}

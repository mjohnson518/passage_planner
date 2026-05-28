import type { Metadata } from "next";
import AnchorageDetailPageClient from "./AnchorageDetailPageClient";

export const metadata: Metadata = {
  title: "Anchorage detail",
  description:
    "Cruiser-contributed anchorage details: depths, holding, shelter directions, and visit notes from sailors who have been there.",
};

export default function Page() {
  return <AnchorageDetailPageClient />;
}

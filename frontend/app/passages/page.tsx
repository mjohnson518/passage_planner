import type { Metadata } from "next";
import PassagesPageClient from "./PassagesPageClient";

export const metadata: Metadata = {
  title: "Passages",
  description:
    "Manage your saved sailing routes and passage plans — search, filter, export, and review weather summaries for every voyage.",
};

export default function PassagesPage() {
  return <PassagesPageClient />;
}

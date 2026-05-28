import type { Metadata } from "next";
import OfflineClient from "./OfflineClient";

export const metadata: Metadata = {
  title: "Offline | Helmwise",
  description:
    "You are offline. Helmwise will reconnect automatically and your cached passage data remains available.",
};

export default function Page() {
  return <OfflineClient />;
}

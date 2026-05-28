import type { Metadata } from "next";
import WeatherPageClient from "./WeatherPageClient";

export const metadata: Metadata = {
  title: "Weather Maps | Helmwise",
  description:
    "Interactive marine weather visualization — wind, waves, precipitation, pressure, and active marine warnings for passage planning.",
};

export default function Page() {
  return <WeatherPageClient />;
}

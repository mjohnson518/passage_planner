import type { Metadata } from "next";
import ApiDocsClient from "./ApiDocsClient";

export const metadata: Metadata = {
  title: "API Documentation | Helmwise",
  description:
    "Reference documentation for the Helmwise API — integrate maritime passage planning, weather, and safety data into your applications.",
};

export default function Page() {
  return <ApiDocsClient />;
}

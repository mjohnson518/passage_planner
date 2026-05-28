import type { Metadata } from "next";
import ProvisioningClient from "./ProvisioningClient";

export const metadata: Metadata = {
  title: "Provisioning Calculator | Helmwise",
  description:
    "Plan food, water, fuel, and supplies for your voyage with the Helmwise provisioning calculator and packing checklist.",
};

export default function Page() {
  return <ProvisioningClient />;
}

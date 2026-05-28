import type { Metadata } from "next";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata: Metadata = {
  title: "Reset Password | Helmwise",
  description:
    "Reset your Helmwise account password to regain access to your maritime passage plans and safety tools.",
};

export default function Page() {
  return <ResetPasswordClient />;
}

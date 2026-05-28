import Link from "next/link";
import { Anchor } from "lucide-react";

export function AuthMobileLogo() {
  return (
    <div className="lg:hidden text-center mb-8">
      <Link href="/" className="inline-flex items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-ocean-deep flex items-center justify-center">
          <Anchor className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-display text-xl font-bold">Helmwise</span>
      </Link>
    </div>
  );
}

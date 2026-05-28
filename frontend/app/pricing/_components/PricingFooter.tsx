"use client";

import Link from "next/link";
import { Anchor } from "lucide-react";

export function PricingFooter() {
  return (
    <footer className="px-4 py-12 sm:px-6 lg:px-8 border-t border-border">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Anchor className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">Helmwise</span>
          </div>
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} Helmwise. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link
              href="/terms"
              className="hover:text-primary transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

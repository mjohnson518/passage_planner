"use client";

/**
 * AuthBrandColumn — the left-side decorative panel for auth pages.
 *
 * Extracted so login, signup, and reset-password all share the same hero
 * surface instead of each inventing its own. Renders only on `lg:` and
 * above; mobile auth pages get a compact logo at the top of the form
 * column instead (callers handle that themselves).
 *
 * Props let callers tune the headline + feature bullets per-page (login
 * leads with "Welcome back" energy, signup with "Start free", etc.) while
 * sharing the gradient surface, compass animation, and brand lockup.
 */

import * as React from "react";
import Link from "next/link";
import { Anchor } from "lucide-react";

interface AuthBrandColumnProps {
  /** Two-line headline; second line is rendered in brass. */
  headline?: { line1: string; line2: string };
  /** Short paragraph below the headline. */
  description?: string;
  /** Bullet list shown beneath the description. */
  features?: string[];
}

const DEFAULT_HEADLINE = {
  line1: "Navigate with",
  line2: "Confidence",
};
const DEFAULT_DESCRIPTION =
  "AI-powered passage planning with real-time weather, tidal predictions, and comprehensive safety analysis.";
const DEFAULT_FEATURES = [
  "Real-time weather routing",
  "Tidal predictions",
  "6 specialized AI agents",
];

export function AuthBrandColumn({
  headline = DEFAULT_HEADLINE,
  description = DEFAULT_DESCRIPTION,
  features = DEFAULT_FEATURES,
}: AuthBrandColumnProps) {
  return (
    <div className="hidden lg:flex lg:w-1/2 section-ocean relative overflow-hidden">
      <div className="absolute inset-0 chart-grid opacity-10" />

      {/* Decorative compass */}
      <svg
        viewBox="0 0 200 200"
        className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] text-white opacity-[0.08] -mr-32 animate-compass-needle"
        fill="none"
        aria-hidden
      >
        <circle
          cx="100"
          cy="100"
          r="95"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx="100"
          cy="100"
          r="80"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <circle
          cx="100"
          cy="100"
          r="60"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <path d="M100 5 L103 40 L100 35 L97 40 Z" fill="currentColor" />
        <path
          d="M100 195 L103 160 L100 165 L97 160 Z"
          fill="currentColor"
          opacity="0.5"
        />
        <path
          d="M5 100 L40 103 L35 100 L40 97 Z"
          fill="currentColor"
          opacity="0.5"
        />
        <path
          d="M195 100 L160 103 L165 100 L160 97 Z"
          fill="currentColor"
          opacity="0.5"
        />
        <circle cx="100" cy="100" r="5" fill="currentColor" />
      </svg>

      <div className="relative z-10 flex flex-col justify-center p-12 lg:p-16">
        <Link href="/" className="inline-flex items-center gap-3 mb-12">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur">
            <Anchor className="h-6 w-6 text-white" />
          </div>
          <span className="font-display text-2xl font-bold text-white">
            Helmwise
          </span>
        </Link>

        <h2 className="font-display text-4xl lg:text-5xl text-white leading-tight mb-6">
          {headline.line1}
          <br />
          <span className="text-brass-300">{headline.line2}</span>
        </h2>

        <p className="text-lg text-white/80 max-w-md">{description}</p>

        <div className="mt-12 space-y-4">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-3 text-white/90"
            >
              <div className="w-2 h-2 rounded-full bg-brass-400" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * Banner — inline notice strip used at the top of pages or above cards.
 *
 * Six variants matching the platform's semantic palette:
 *   - info        (neutral foreground/muted background)
 *   - success     (semantic --success token)
 *   - warning     (semantic --warning token; coverage limited, draft mode, etc.)
 *   - destructive (semantic --destructive token; failed-fetch, safety-unverified)
 *   - safety      (highlighted brand variant for life-safety messaging —
 *                  uses the maritime brass tint to stand apart from generic
 *                  errors; never use for non-safety content)
 *   - demo        (brass tint for the demo-mode banner)
 *
 * Compound API:
 *
 *   <Banner variant="warning" icon={<AlertTriangle className="h-4 w-4" />}>
 *     <BannerTitle>Coverage limited</BannerTitle>
 *     <BannerDescription>This passage extends outside Helmwise's validated zones.</BannerDescription>
 *     <BannerAction><Button size="sm">Got it</Button></BannerAction>
 *   </Banner>
 *
 * The icon, title, description, and action slots are optional. Compose as
 * needed. The banner is non-dismissible by default — safety messaging
 * should not be dismissible per CLAUDE.md.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const bannerVariants = cva(
  "relative w-full flex items-start gap-3 rounded-lg border p-4 text-sm",
  {
    variants: {
      variant: {
        info: "bg-muted/40 border-border text-foreground [&_svg]:text-muted-foreground",
        success:
          "bg-success/10 border-success/30 text-success [&_svg]:text-success",
        warning:
          "bg-warning/10 border-warning/40 text-warning [&_svg]:text-warning",
        destructive:
          "bg-destructive/10 border-destructive/40 text-destructive [&_svg]:text-destructive",
        safety:
          "bg-brass/10 border-brass/40 text-brass-dark dark:text-brass [&_svg]:text-brass-dark dark:[&_svg]:text-brass",
        demo: "bg-brass-100 dark:bg-brass-900/20 border-brass-300 dark:border-brass-700 text-brass-800 dark:text-brass-300 [&_svg]:text-brass-600 dark:[&_svg]:text-brass-400",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

interface BannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bannerVariants> {
  icon?: React.ReactNode;
}

const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <div
      ref={ref}
      role={
        variant === "destructive" || variant === "safety" ? "alert" : "status"
      }
      className={cn(bannerVariants({ variant }), className)}
      {...props}
    >
      {icon && <div className="flex-shrink-0 pt-0.5">{icon}</div>}
      <div className="flex-1 min-w-0 space-y-1">{children}</div>
    </div>
  ),
);
Banner.displayName = "Banner";

const BannerTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("font-semibold leading-tight", className)}
    {...props}
  />
));
BannerTitle.displayName = "BannerTitle";

const BannerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm opacity-90 leading-relaxed", className)}
    {...props}
  />
));
BannerDescription.displayName = "BannerDescription";

const BannerAction = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2 mt-2", className)}
    {...props}
  />
));
BannerAction.displayName = "BannerAction";

export { Banner, BannerTitle, BannerDescription, BannerAction, bannerVariants };

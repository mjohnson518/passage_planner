"use client";

/**
 * EmptyState — consistent "no data yet" placeholder.
 *
 * Used wherever a list/grid would otherwise render an empty container.
 * Three slots — icon, title, description — plus an optional action.
 * Centered and generously padded so it never looks like an error or a
 * broken render. Lives at this level (not inside a Card) so callers can
 * choose their own surface.
 *
 *   <EmptyState
 *     icon={<Anchor className="h-12 w-12" />}
 *     title="No passages yet"
 *     description="Plan your first passage to see it here."
 *     action={<Button onClick={onNew}>Plan a passage</Button>}
 *   />
 */

import * as React from "react";
import { cn } from "../../lib/utils";

interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Footnote rendered under the action, for caveats / "or" choices. */
  footnote?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    { className, icon, title, description, action, footnote, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 gap-4",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1.5 max-w-md">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
      {footnote && (
        <p className="pt-2 text-xs text-muted-foreground">{footnote}</p>
      )}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

export { EmptyState };

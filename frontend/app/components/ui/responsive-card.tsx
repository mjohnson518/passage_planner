import * as React from "react"
import { cn } from "../../lib/utils"

export interface ResponsiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  fullWidthMobile?: boolean
  noPaddingMobile?: boolean
}

const ResponsiveCard = React.forwardRef<HTMLDivElement, ResponsiveCardProps>(
  ({ className, fullWidthMobile = false, noPaddingMobile = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        fullWidthMobile && "sm:rounded-lg rounded-none sm:mx-0 -mx-4",
        noPaddingMobile && "sm:p-6 p-4",
        className
      )}
      {...props}
    />
  )
)
ResponsiveCard.displayName = "ResponsiveCard"

const ResponsiveCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)}
    {...props}
  />
))
ResponsiveCardHeader.displayName = "ResponsiveCardHeader"

const ResponsiveCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg sm:text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
ResponsiveCardTitle.displayName = "ResponsiveCardTitle"

const ResponsiveCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
ResponsiveCardDescription.displayName = "ResponsiveCardDescription"

const ResponsiveCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 sm:p-6 pt-0", className)} {...props} />
))
ResponsiveCardContent.displayName = "ResponsiveCardContent"

const ResponsiveCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 sm:p-6 pt-0", className)}
    {...props}
  />
))
ResponsiveCardFooter.displayName = "ResponsiveCardFooter"

export {
  ResponsiveCard,
  ResponsiveCardHeader,
  ResponsiveCardFooter,
  ResponsiveCardTitle,
  ResponsiveCardDescription,
  ResponsiveCardContent,
} 
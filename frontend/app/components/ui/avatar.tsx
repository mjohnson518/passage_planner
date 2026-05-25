"use client";

/**
 * Avatar — circular user image with fallback to initials.
 *
 * Built without @radix-ui/react-avatar to avoid a new dep — the use case
 * here is simple enough that a minimal img + fallback covers it. Used by
 * the header user menu, the fleet members list, and any future "user
 * present" affordance.
 *
 *   <Avatar>
 *     <AvatarImage src={user.avatar_url} alt={user.full_name} />
 *     <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
 *   </Avatar>
 *
 * If `src` is missing or fails to load, the fallback is shown. The Avatar
 * root is keyboard-focusable when wrapped in a button, otherwise it's
 * presentational.
 */

import * as React from "react";
import { cn } from "../../lib/utils";

type AvatarContextValue = {
  imageLoaded: boolean;
  setImageLoaded: (v: boolean) => void;
};
const AvatarContext = React.createContext<AvatarContextValue | null>(null);

const Avatar = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { size?: "sm" | "md" | "lg" }
>(({ className, size = "md", ...props }, ref) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const sizeClass =
    size === "sm"
      ? "h-8 w-8 text-xs"
      : size === "lg"
        ? "h-12 w-12 text-base"
        : "h-10 w-10 text-sm";
  return (
    <AvatarContext.Provider value={{ imageLoaded, setImageLoaded }}>
      <span
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground font-medium select-none",
          sizeClass,
          className,
        )}
        {...props}
      />
    </AvatarContext.Provider>
  );
});
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, onLoad, onError, ...props }, ref) => {
  const ctx = React.useContext(AvatarContext);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      className={cn(
        "aspect-square h-full w-full object-cover",
        // Hide the broken-image affordance if the image fails — the
        // fallback child renders behind, so it'll appear naturally.
        !ctx?.imageLoaded && "invisible",
        className,
      )}
      onLoad={(e) => {
        ctx?.setImageLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        ctx?.setImageLoaded(false);
        onError?.(e);
      }}
      {...props}
    />
  );
});
AvatarImage.displayName = "AvatarImage";

/**
 * Rendered when `<AvatarImage>` has no `src`, hasn't loaded yet, or
 * failed. Sits behind the image so it shows through when invisible.
 */
const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "absolute inset-0 flex items-center justify-center",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

/**
 * Helper to extract initials from a name string.
 * "Marc Johnson" → "MJ"; "marc" → "M"; "" → "?".
 */
export function avatarInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export { Avatar, AvatarImage, AvatarFallback };

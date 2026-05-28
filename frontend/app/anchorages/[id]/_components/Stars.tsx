import { Star } from "lucide-react";
import { cn } from "../../../lib/utils";

export function Stars({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i <= value
              ? "fill-warning text-warning"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

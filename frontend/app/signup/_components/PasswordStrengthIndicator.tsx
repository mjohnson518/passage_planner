import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface PasswordRequirement {
  regex: RegExp;
  text: string;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  requirements: PasswordRequirement[];
  strength: number;
}

export function PasswordStrengthIndicator({
  password,
  requirements,
  strength,
}: PasswordStrengthIndicatorProps) {
  return (
    <div data-testid="signup-password-strength" className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < strength
                ? strength <= 2
                  ? "bg-warning"
                  : "bg-success"
                : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="space-y-1">
        {requirements.map((req) => (
          <div
            key={req.text}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              req.regex.test(password)
                ? "text-success"
                : "text-muted-foreground",
            )}
          >
            <Check
              className={cn(
                "h-3 w-3",
                req.regex.test(password) ? "opacity-100" : "opacity-0",
              )}
            />
            {req.text}
          </div>
        ))}
      </div>
    </div>
  );
}

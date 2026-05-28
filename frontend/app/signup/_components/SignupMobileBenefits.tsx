import { Check } from "lucide-react";

export function SignupMobileBenefits() {
  return (
    <div className="lg:hidden mt-8 space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <Check className="h-5 w-5 text-success flex-shrink-0" />
        <span>Start with 2 free passages per month</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Check className="h-5 w-5 text-success flex-shrink-0" />
        <span>14-day free trial of Premium features</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Check className="h-5 w-5 text-success flex-shrink-0" />
        <span>No credit card required</span>
      </div>
    </div>
  );
}

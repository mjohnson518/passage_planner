import type { PassagePlanningResponse } from "../../../lib/services/passagePlanningService";

interface PlannerSafetyBannersProps {
  passagePlan: PassagePlanningResponse;
}

export function PlannerSafetyBanners({
  passagePlan,
}: PlannerSafetyBannersProps) {
  return (
    <>
      {/* SAFETY_UNVERIFIED critical banner — shown when SafetyAgent failed */}
      {passagePlan.status === "SAFETY_UNVERIFIED" && (
        <div
          className="rounded-md border-2 border-destructive bg-destructive/5 px-5 py-4"
          role="alert"
        >
          <p className="font-bold text-destructive text-base uppercase tracking-wide mb-1">
            ⚠ Safety Checks Could Not Be Completed
          </p>
          <p className="text-destructive/80 text-sm">
            Automated safety verification failed for this passage plan.{" "}
            <strong>Manual verification is required before departure.</strong>{" "}
            Do not rely on this plan without independently checking all safety
            conditions against official nautical charts, NOAA marine forecasts,
            active NOTAMs, and current tidal information.
          </p>
        </div>
      )}

      {/* SAFETY_WARNING amber banner — shown when critical hazards detected */}
      {passagePlan.status === "SAFETY_WARNING" && (
        <div
          className="rounded-md border-2 border-warning bg-warning/5 px-5 py-4"
          role="alert"
        >
          <p className="font-bold text-warning text-base uppercase tracking-wide mb-1">
            ⚠ Safety Warnings Detected
          </p>
          <p className="text-warning/80 text-sm">
            Critical hazards were identified along this route. Review all safety
            warnings carefully.
            <strong>
              {" "}
              Do not depart without addressing every critical warning below.
            </strong>
          </p>
        </div>
      )}

      {/* COVERAGE_LIMITED banner — shown when route exits validated coverage region */}
      {(passagePlan.status === "COVERAGE_LIMITED" ||
        passagePlan.coverageDisclaimer) && (
        <div
          className="rounded-md border-2 border-warning bg-warning/5 px-5 py-4"
          role="alert"
          data-testid="planner-coverage-limited-banner"
        >
          <p className="font-bold text-warning text-base uppercase tracking-wide mb-1">
            ⚠ Coverage Limited
          </p>
          <p className="text-warning/80 text-sm mb-3">
            {passagePlan.coverageDisclaimer?.message ||
              "This passage extends outside Helmwise's validated coverage region. Treat the plan as advisory and verify with official sources before departure."}
          </p>
          {passagePlan.coverageDisclaimer?.gaps &&
            passagePlan.coverageDisclaimer.gaps.length > 0 && (
              <div className="text-warning/80 text-sm">
                <p className="font-semibold mb-1">Known gaps in this region:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {passagePlan.coverageDisclaimer.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
    </>
  );
}

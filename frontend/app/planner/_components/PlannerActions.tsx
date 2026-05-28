"use client";

import { Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";

interface PlannerActionsProps {
  loading: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export function PlannerActions({
  loading,
  canSubmit,
  onCancel,
  onSubmit,
}: PlannerActionsProps) {
  return (
    <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t lg:relative lg:bottom-auto lg:p-0 lg:border-0 lg:bg-transparent lg:mt-6">
      <div className="flex gap-3 max-w-4xl mx-auto">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 lg:flex-initial"
        >
          Cancel
        </Button>
        <Button
          data-testid="planner-submit"
          onClick={onSubmit}
          disabled={loading || !canSubmit}
          className="flex-1 lg:flex-initial"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Planning…
            </>
          ) : (
            "Create Passage Plan"
          )}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Card, CardContent } from "../../components/ui/card";
import type { Passage } from "./PassageCard";

interface PassageSummaryStatsProps {
  passages: Passage[];
}

export function PassageSummaryStats({ passages }: PassageSummaryStatsProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{passages.length}</div>
            <div className="text-sm text-muted-foreground">Total Passages</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {passages.filter((p) => p.status === "planned").length}
            </div>
            <div className="text-sm text-muted-foreground">Upcoming</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {passages
                .reduce((sum, p) => sum + p.distanceNm, 0)
                .toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Total Miles</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {passages.filter((p) => p.status === "completed").length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

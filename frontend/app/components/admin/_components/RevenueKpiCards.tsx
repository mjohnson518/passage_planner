"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { DollarSign, TrendingUp, TrendingDown, Users } from "lucide-react";

interface RevenueKpiCardsProps {
  mrr: number;
  arr: number;
  growth: number;
  churn: number;
  ltv: number;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
}

export function RevenueKpiCards({
  mrr,
  arr,
  growth,
  churn,
  ltv,
  formatCurrency,
  formatPercentage,
}: RevenueKpiCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Monthly Recurring Revenue
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(mrr)}</div>
          <p className="text-xs text-muted-foreground">
            <span className={growth >= 0 ? "text-success" : "text-destructive"}>
              {formatPercentage(growth)}
            </span>{" "}
            from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Annual Recurring Revenue
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(arr)}</div>
          <p className="text-xs text-muted-foreground">Projected from MRR</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{churn.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">Monthly average</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Customer LTV</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(ltv)}</div>
          <p className="text-xs text-muted-foreground">
            Average lifetime value
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

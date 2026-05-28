"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface CohortRetentionChartProps {
  data: Array<{ week: number; retention: number }>;
}

export default function CohortRetentionChart({
  data,
}: CohortRetentionChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="week"
          label={{
            value: "Weeks after signup",
            position: "insideBottom",
            offset: -5,
          }}
        />
        <YAxis
          label={{
            value: "Retention %",
            angle: -90,
            position: "insideLeft",
          }}
        />
        <Tooltip formatter={(value: number) => `${value}%`} />
        <Area
          type="monotone"
          dataKey="retention"
          stroke={chartColors.quaternary}
          fill={chartColors.quaternary}
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

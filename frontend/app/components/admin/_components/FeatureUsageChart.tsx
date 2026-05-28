"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface FeatureUsageChartProps {
  data: Array<{
    feature: string;
    usage: number;
    tier: "free" | "pro" | "enterprise";
  }>;
}

export default function FeatureUsageChart({ data }: FeatureUsageChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="feature" angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="usage" fill={chartColors.primary}>
          {data.map((entry) => (
            <Cell
              key={entry.feature}
              fill={
                entry.tier === "enterprise"
                  ? chartColors.danger
                  : entry.tier === "pro"
                    ? chartColors.secondary
                    : chartColors.primary
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

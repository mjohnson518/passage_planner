"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface ChurnAnalysisChartProps {
  data: Array<{ month: string; rate: number; count: number }>;
}

export default function ChurnAnalysisChart({ data }: ChurnAnalysisChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis yAxisId="left" orientation="left" stroke={chartColors.primary} />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke={chartColors.secondary}
        />
        <Tooltip />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="rate"
          fill={chartColors.primary}
          name="Churn Rate (%)"
        />
        <Bar
          yAxisId="right"
          dataKey="count"
          fill={chartColors.secondary}
          name="Customers Lost"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

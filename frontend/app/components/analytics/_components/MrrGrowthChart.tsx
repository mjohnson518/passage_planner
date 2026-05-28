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

interface MrrGrowthChartProps {
  data: Array<{ date: string; value: number }>;
}

export default function MrrGrowthChart({ data }: MrrGrowthChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip formatter={(value: number) => `$${value}`} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={chartColors.primary}
          fill={chartColors.primary}
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

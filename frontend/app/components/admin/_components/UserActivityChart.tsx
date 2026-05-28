"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface UserActivityChartProps {
  data: Array<{ date: string; count: number }>;
}

export default function UserActivityChart({ data }: UserActivityChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="count"
          stroke={chartColors.primary}
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

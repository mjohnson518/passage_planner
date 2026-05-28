"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface UserGrowthChartProps {
  data: Array<{ date: string; total: number; paid: number; trial: number }>;
}

export default function UserGrowthChart({ data }: UserGrowthChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="total"
          stroke={chartColors.primary}
          name="Total Users"
        />
        <Line
          type="monotone"
          dataKey="paid"
          stroke={chartColors.success}
          name="Paid Users"
        />
        <Line
          type="monotone"
          dataKey="trial"
          stroke={chartColors.tertiary}
          name="Trial Users"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

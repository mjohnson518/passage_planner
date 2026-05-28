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
  Legend,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface AdminRevenueChartProps {
  data: any[];
  formatCurrency: (value: number) => string;
}

export default function AdminRevenueChart({
  data,
  formatCurrency,
}: AdminRevenueChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis tickFormatter={(value) => `$${value / 1000}k`} />
        <Tooltip formatter={(value: any) => formatCurrency(value)} />
        <Legend />
        <Line
          type="monotone"
          dataKey="mrr"
          stroke={chartColors.primary}
          name="MRR"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="arr"
          stroke={chartColors.secondary}
          name="ARR"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface AdminUserGrowthChartProps {
  data: any[];
}

export default function AdminUserGrowthChart({
  data,
}: AdminUserGrowthChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="new" fill={chartColors.success} name="New Users" />
        <Bar dataKey="churned" fill={chartColors.danger} name="Churned" />
      </BarChart>
    </ResponsiveContainer>
  );
}

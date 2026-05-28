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
} from "recharts";
import { useChartColors } from "../../../lib/chart-colors";

interface PopularRoutesChartProps {
  data: Array<{ route: string; count: number }>;
}

export default function PopularRoutesChart({ data }: PopularRoutesChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis dataKey="route" type="category" width={120} />
        <Tooltip />
        <Bar dataKey="count" fill={chartColors.quaternary} />
      </BarChart>
    </ResponsiveContainer>
  );
}

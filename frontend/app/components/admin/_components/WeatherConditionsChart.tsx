"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface WeatherConditionsChartProps {
  data: Array<{ condition: string; count: number; percentage: number }>;
}

export default function WeatherConditionsChart({
  data,
}: WeatherConditionsChartProps) {
  const chartColors = useChartColors();
  const COLORS = [
    chartColors.primary,
    chartColors.secondary,
    chartColors.tertiary,
    chartColors.danger,
    chartColors.quaternary,
    chartColors.success,
  ];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ condition, percentage }) => `${condition}: ${percentage}%`}
          outerRadius={80}
          fill={chartColors.primary}
          dataKey="count"
        >
          {data.map((entry, index) => (
            <Cell key={entry.condition} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

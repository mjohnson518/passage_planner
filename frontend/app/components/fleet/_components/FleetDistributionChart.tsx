"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "../../../lib/chart-colors";

interface FleetDistributionChartProps {
  data: Array<{ name: string; value: number }>;
}

export default function FleetDistributionChart({
  data,
}: FleetDistributionChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }: any) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          outerRadius={80}
          fill={chartColors.primary}
          dataKey="value"
        >
          {data.map((entry: any, index: number) => (
            <Cell
              key={`cell-${entry.name}`}
              fill={Object.values(chartColors)[index % 5] as string}
            />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

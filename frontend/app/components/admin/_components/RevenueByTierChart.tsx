"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface RevenueByTierChartProps {
  data: Array<{ tier: string; revenue: number; users: number }>;
  formatCurrency: (value: number) => string;
}

export default function RevenueByTierChart({
  data,
  formatCurrency,
}: RevenueByTierChartProps) {
  const chartColors = useChartColors();
  const COLORS = [
    chartColors.primary,
    chartColors.secondary,
    chartColors.tertiary,
    chartColors.danger,
  ];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ tier, percent }: any) =>
            `${tier}: ${(percent * 100).toFixed(0)}%`
          }
          outerRadius={80}
          fill={chartColors.primary}
          dataKey="revenue"
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${entry.tier}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value: any) => formatCurrency(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

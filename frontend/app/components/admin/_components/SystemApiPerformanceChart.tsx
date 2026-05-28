"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface SystemApiPerformanceChartProps {
  data: Array<{
    time: string;
    cpu: number;
    memory: number;
    requests: number;
    responseTime: number;
  }>;
}

export default function SystemApiPerformanceChart({
  data,
}: SystemApiPerformanceChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="requests"
          stroke={chartColors.primary}
          fill={chartColors.primary}
          fillOpacity={0.3}
          name="Requests"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="responseTime"
          stroke={chartColors.tertiary}
          strokeWidth={2}
          name="Response Time (ms)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

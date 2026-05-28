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

interface SystemPerformanceChartProps {
  data: Array<{
    time: string;
    cpu: number;
    memory: number;
    requests: number;
    responseTime: number;
  }>;
}

export default function SystemPerformanceChart({
  data,
}: SystemPerformanceChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="cpu"
          stroke={chartColors.primary}
          strokeWidth={2}
          name="CPU %"
        />
        <Line
          type="monotone"
          dataKey="memory"
          stroke={chartColors.secondary}
          strokeWidth={2}
          name="Memory %"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

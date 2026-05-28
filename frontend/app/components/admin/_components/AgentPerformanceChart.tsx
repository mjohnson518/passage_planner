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

interface AgentHistoryPoint {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  requestsPerMinute: number;
  avgResponseTime: number;
}

interface AgentPerformanceChartProps {
  data: AgentHistoryPoint[];
}

export default function AgentPerformanceChart({
  data,
}: AgentPerformanceChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="cpuUsage"
          stroke={chartColors.primary}
          strokeWidth={2}
          name="CPU %"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="memoryUsage"
          stroke={chartColors.secondary}
          strokeWidth={2}
          name="Memory %"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="avgResponseTime"
          stroke={chartColors.tertiary}
          strokeWidth={2}
          name="Response Time (ms)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

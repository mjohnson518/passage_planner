"use client";

// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- recharts compositional named exports can't be individually dynamic-imported; this leaf is code-split via next/dynamic from its consumer.
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface PerformanceRadarChartProps {
  data: Array<{ metric: string; value: number }>;
}

export default function PerformanceRadarChart({
  data,
}: PerformanceRadarChartProps) {
  const chartColors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" />
        <PolarRadiusAxis angle={90} domain={[0, 100]} />
        <Radar
          name="Performance"
          dataKey="value"
          stroke={chartColors.primary}
          fill={chartColors.primary}
          fillOpacity={0.4}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

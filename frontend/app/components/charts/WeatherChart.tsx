import React from 'react';

interface WeatherChartProps {
  data?: any;
}

export default function WeatherChart({ data }: WeatherChartProps) {
  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <p className="text-sm text-gray-600">
        Weather visualization coming soon
      </p>
    </div>
  );
}


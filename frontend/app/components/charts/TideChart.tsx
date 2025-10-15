import React from 'react';

interface TideChartProps {
  data?: any;
}

export default function TideChart({ data }: TideChartProps) {
  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <p className="text-sm text-gray-600">
        Tide visualization coming soon
      </p>
    </div>
  );
}


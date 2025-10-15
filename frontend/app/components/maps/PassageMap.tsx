import React from 'react';

interface PassageMapProps {
  data?: any;
}

export default function PassageMap({ data }: PassageMapProps) {
  return (
    <div className="w-full h-96 border rounded-lg bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-600">
        Interactive passage map coming soon
      </p>
    </div>
  );
}


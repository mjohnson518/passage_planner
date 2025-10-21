import React from 'react';

interface PassageMapProps {
  data?: any;
}

export default function PassageMap({ data }: PassageMapProps) {
  // Dynamically import to avoid SSR issues with Leaflet
  const RouteMap = dynamic(() => import('../map/RouteMap'), {
    ssr: false,
    loading: () => (
      <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    )
  })

  return (
    <RouteMap
      waypoints={data?.waypoints || []}
      center={data?.center}
      zoom={data?.zoom || 8}
      height="384px"
    />
  )
}


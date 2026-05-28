import { Skeleton } from "./ui/skeleton";

// Loading placeholder for lazily-loaded chart/dashboard components.
export const ChartLoader = () => (
  <div className="w-full h-[300px]">
    <Skeleton className="w-full h-full" />
  </div>
);

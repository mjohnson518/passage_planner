import dynamic from "next/dynamic";
import { ChartLoader } from "./lazy-loaders";

export const LazyFleetAnalytics = dynamic(
  () => import("./fleet/FleetAnalyticsDashboard"),
  {
    loading: () => <ChartLoader />,
  },
);

// Lazy loaded admin components (code-split per tab)
export const LazyAdminOverview = dynamic(
  () =>
    import("./admin/AdminOverview").then((m) => ({ default: m.AdminOverview })),
  { loading: () => <ChartLoader /> },
);

export const LazyUserManagement = dynamic(
  () =>
    import("./admin/UserManagement").then((m) => ({
      default: m.UserManagement,
    })),
  { loading: () => <ChartLoader /> },
);

export const LazyRevenueMetrics = dynamic(
  () =>
    import("./admin/RevenueMetrics").then((m) => ({
      default: m.RevenueMetrics,
    })),
  { loading: () => <ChartLoader /> },
);

export const LazySystemHealth = dynamic(
  () =>
    import("./admin/SystemHealth").then((m) => ({ default: m.SystemHealth })),
  { loading: () => <ChartLoader /> },
);

export const LazyAgentMonitoring = dynamic(
  () =>
    import("./admin/AgentMonitoring").then((m) => ({
      default: m.AgentMonitoring,
    })),
  { loading: () => <ChartLoader /> },
);

export const LazyAnalyticsReports = dynamic(
  () =>
    import("./admin/AnalyticsReports").then((m) => ({
      default: m.AnalyticsReports,
    })),
  { loading: () => <ChartLoader /> },
);

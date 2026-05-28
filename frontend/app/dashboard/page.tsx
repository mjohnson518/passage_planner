"use client";

import { useEffect, useReducer } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import {
  Banner,
  BannerTitle,
  BannerDescription,
} from "../components/ui/banner";
import dynamic from "next/dynamic";
import { Skeleton } from "../components/ui/skeleton";

const DemoPassage = dynamic(
  () =>
    import("../components/demo/DemoPassage").then((m) => ({
      default: m.DemoPassage,
    })),
  { loading: () => <Skeleton className="h-[300px] w-full" /> },
);
import { Plus, Anchor, AlertCircle } from "lucide-react";
import Link from "next/link";
import { QuickActions } from "./_components/QuickActions";
import { StatsOverview } from "./_components/StatsOverview";
import {
  RecentPassagesCard,
  type RecentPassage,
} from "./_components/RecentPassagesCard";

interface DashboardStats {
  totalPassages: number;
  totalDistance: number;
  avgDuration: number;
}

// All dashboard view state consolidated. The single mount effect resolves
// demo-vs-real once and dispatches one update — no cascading setState.
interface DashboardState {
  recentPassages: RecentPassage[];
  stats: DashboardStats;
  isDemoMode: boolean;
  displayName: string;
  isLoading: boolean;
}

type DashboardAction = { type: "loaded"; value: Partial<DashboardState> };

const initialDashboardState: DashboardState = {
  recentPassages: [],
  stats: {
    totalPassages: 0,
    totalDistance: 0,
    avgDuration: 0,
  },
  isDemoMode: false,
  displayName: "Captain",
  isLoading: true,
};

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "loaded":
      return { ...state, ...action.value };
    default:
      return state;
  }
}

// Demo data for when user is in demo mode
const DEMO_PASSAGES: RecentPassage[] = [
  {
    id: "demo-1",
    departure: "Miami, FL",
    destination: "Nassau, Bahamas",
    date: "2024-12-05",
    status: "completed",
    distance: 184,
  },
  {
    id: "demo-2",
    departure: "Key West, FL",
    destination: "Havana, Cuba",
    date: "2024-12-10",
    status: "planned",
    distance: 106,
  },
  {
    id: "demo-3",
    departure: "Fort Lauderdale, FL",
    destination: "Bimini, Bahamas",
    date: "2024-12-01",
    status: "completed",
    distance: 50,
  },
];

const DEMO_STATS: DashboardStats = {
  totalPassages: 24,
  totalDistance: 2847,
  avgDuration: 16.5,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { push } = useRouter();
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState);
  const { recentPassages, stats, isDemoMode, displayName, isLoading } = state;

  useEffect(() => {
    // Check for demo mode
    const demoMode =
      typeof window !== "undefined" &&
      localStorage.getItem("helmwise_demo_mode") === "true";

    if (!user && !demoMode) {
      dispatch({ type: "loaded", value: { isDemoMode: demoMode } });
      push("/login");
      return;
    }

    if (demoMode) {
      // Load demo data
      dispatch({
        type: "loaded",
        value: {
          isDemoMode: demoMode,
          recentPassages: DEMO_PASSAGES,
          stats: DEMO_STATS,
          displayName: "Demo Captain",
          isLoading: false,
        },
      });
    } else if (user) {
      // Load real user data
      dispatch({
        type: "loaded",
        value: {
          isDemoMode: demoMode,
          displayName: user.email?.split("@")[0] || "Captain",
          recentPassages: [
            {
              id: "1",
              departure: "Boston, MA",
              destination: "Portland, ME",
              date: "2024-01-15",
              status: "completed",
              distance: 98,
            },
            {
              id: "2",
              departure: "Newport, RI",
              destination: "Block Island",
              date: "2024-01-20",
              status: "planned",
              distance: 45,
            },
          ],
          stats: {
            totalPassages: 12,
            totalDistance: 1234,
            avgDuration: 18.5,
          },
          isLoading: false,
        },
      });
    }
  }, [user, push]);

  const handleExitDemo = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("helmwise_demo_mode");
      push("/login");
    }
  };

  // Show loading state
  if (isLoading && !isDemoMode && !user) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background pattern */}
      {/* Decorative grid — dimmer in dark mode so it reads as ambient
          texture, not muddy noise. */}
      <div className="absolute inset-0 chart-grid opacity-30 dark:opacity-[0.08]" />

      <div className="relative container mx-auto px-4 py-8 lg:py-12 max-w-7xl">
        {/* Demo Mode Banner — uses the shared <Banner variant="demo">
            so the brass styling stays consistent with any future banners. */}
        {isDemoMode && (
          <Banner
            data-testid="dashboard-demo-banner"
            variant="demo"
            icon={<AlertCircle className="h-5 w-5" />}
            className="mb-6 items-center"
          >
            <div className="flex items-center justify-between gap-4 flex-1">
              <div>
                <BannerTitle>Demo Mode Active</BannerTitle>
                <BannerDescription>
                  You&apos;re exploring Helmwise with sample data
                </BannerDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExitDemo}
                className="border-brass-400 text-brass-700 dark:text-brass-300 hover:bg-brass-200 dark:hover:bg-brass-800 flex-shrink-0"
              >
                Exit Demo
              </Button>
            </div>
          </Banner>
        )}

        {/* Welcome Section */}
        <div data-testid="dashboard-welcome" className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-ocean-deep flex items-center justify-center">
              <Anchor className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-display">
                Welcome back,{" "}
                <span className="text-gradient">{displayName}</span>
              </h1>
              <p className="text-muted-foreground">
                Ready to plan your next sailing adventure?
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Stats Overview */}
        <StatsOverview stats={stats} />

        {/* Recent Passages & Demo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentPassagesCard recentPassages={recentPassages} />

          {/* Demo Passage */}
          <div className="hidden sm:block">
            <DemoPassage />
          </div>
        </div>

        {/* Floating Action Button for Mobile */}
        <Link href="/planner" className="lg:hidden">
          <Button size="lg" className="fab w-14 h-14 p-0">
            <Plus className="h-6 w-6" />
            <span className="sr-only">New Passage</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

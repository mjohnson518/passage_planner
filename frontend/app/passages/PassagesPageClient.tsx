"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Plus, FileText } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAnalytics } from "../hooks/useAnalytics";
import { deduplicatedFetch } from "../lib/performance";
import RequireAuth from "../components/auth/RequireAuth";
import { features } from "../lib/features";
import { logger } from "../lib/logger";
import { PassageFilters } from "./_components/PassageFilters";
import { PassageCard, type Passage } from "./_components/PassageCard";
import { PassageSummaryStats } from "./_components/PassageSummaryStats";

type SortOption = "date" | "name" | "distance" | "status";
type FilterStatus = "all" | "draft" | "planned" | "completed";

interface FilterState {
  searchQuery: string;
  statusFilter: FilterStatus;
  sortBy: SortOption;
}

type FilterAction =
  | { type: "searchChanged"; value: string }
  | { type: "statusChanged"; value: FilterStatus }
  | { type: "sortChanged"; value: SortOption };

const initialFilterState: FilterState = {
  searchQuery: "",
  statusFilter: "all",
  sortBy: "date",
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "searchChanged":
      return { ...state, searchQuery: action.value };
    case "statusChanged":
      return { ...state, statusFilter: action.value };
    case "sortChanged":
      return { ...state, sortBy: action.value };
    default:
      return state;
  }
}

function filterAndSortPassages(
  passages: Passage[],
  searchQuery: string,
  statusFilter: FilterStatus,
  sortBy: SortOption,
): Passage[] {
  let filtered = [...passages];

  // Apply search filter
  if (searchQuery) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.departure.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.destination.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }

  // Apply status filter
  if (statusFilter !== "all") {
    filtered = filtered.filter((p) => p.status === statusFilter);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortBy) {
      case "date":
        return (
          new Date(b.departureDate).getTime() -
          new Date(a.departureDate).getTime()
        );
      case "name":
        return a.name.localeCompare(b.name);
      case "distance":
        return b.distanceNm - a.distanceNm;
      case "status":
        const statusOrder = { draft: 0, planned: 1, completed: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      default:
        return 0;
    }
  });

  return filtered;
}

function PassagesPageInner() {
  const { user, session } = useAuth();
  const { push } = useRouter();
  const { track, trackFeature } = useAnalytics();
  const queryClient = useQueryClient();
  const [filters, dispatchFilter] = useReducer(
    filterReducer,
    initialFilterState,
  );
  const { searchQuery, statusFilter, sortBy } = filters;
  const [selectedPassages, setSelectedPassages] = useState<Set<string>>(
    new Set(),
  );

  const passagesQueryKey = ["passages-list", user?.id];

  const { data: passages = [], isLoading: loading } = useQuery<Passage[]>({
    queryKey: passagesQueryKey,
    enabled: !!user,
    queryFn: async () => {
      try {
        const data = await deduplicatedFetch(
          `passages-list-${user?.id}`,
          async () => {
            const response = await fetch("/api/passages", {
              headers: {
                Authorization: `Bearer ${session?.access_token}`,
              },
            });

            if (!response.ok) {
              throw new Error("Failed to fetch passages");
            }

            return response.json();
          },
          30000, // Cache for 30 seconds
        );

        // Transform snake_case from DB to camelCase for frontend
        const transformedPassages: Passage[] = (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          departure: p.departure,
          destination: p.destination,
          departureDate: p.departure_date,
          distanceNm: p.distance_nm,
          estimatedDuration: p.estimated_duration,
          status: p.status,
          weatherSummary: p.weather_summary,
          boatName: p.boat_name,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));

        return transformedPassages;
      } catch (error) {
        logger.error("Failed to load passages", { error: String(error) });
        return [];
      }
    },
  });

  useEffect(() => {
    if (!user) {
      push("/login");
      return;
    }

    track("page_view", { page: "passages" });
  }, [user, push, track]);

  const filteredPassages = useMemo(
    () => filterAndSortPassages(passages, searchQuery, statusFilter, sortBy),
    [passages, searchQuery, statusFilter, sortBy],
  );

  const handleNewPassage = () => {
    trackFeature("new_passage_clicked", { source: "passages_page" });
    push("/planner");
  };

  const handleViewPassage = (passageId: string) => {
    trackFeature("view_passage", { passageId, source: "passages_list" });
    push(`/passages/${passageId}`);
  };

  const handleEditPassage = (passageId: string) => {
    trackFeature("edit_passage", { passageId, source: "passages_list" });
    push(`/planner?edit=${passageId}`);
  };

  const handleDeletePassage = async (passageId: string) => {
    if (!confirm("Are you sure you want to delete this passage?")) return;
    if (!session?.access_token) return;

    trackFeature("delete_passage", { passageId });

    const previous = passages;
    queryClient.setQueryData<Passage[]>(
      passagesQueryKey,
      passages.filter((p) => p.id !== passageId),
    );

    try {
      const res = await fetch(`/api/passages/${passageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
    } catch (err) {
      queryClient.setQueryData<Passage[]>(passagesQueryKey, previous);
      alert("Failed to delete passage. Please try again.");
    }
  };

  const handleBulkExport = async () => {
    if (selectedPassages.size === 0) return;
    if (!session?.access_token) return;

    trackFeature("bulk_export", { count: selectedPassages.size });

    try {
      const res = await fetch("/api/passages/export/bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passageIds: Array.from(selectedPassages),
          format: "gpx",
        }),
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passages-export-${Date.now()}.gpx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSelectedPassages(new Set());
    } catch (err) {
      alert("Failed to export passages. Please try again.");
    }
  };

  const togglePassageSelection = (passageId: string) => {
    const newSelection = new Set(selectedPassages);
    if (newSelection.has(passageId)) {
      newSelection.delete(passageId);
    } else {
      newSelection.add(passageId);
    }
    setSelectedPassages(newSelection);
  };

  if (!user) return null;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 relative">
      <div className="absolute inset-0 chart-grid opacity-30 pointer-events-none" />
      <div className="relative flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">
            Passages
          </h1>
          <p className="text-muted-foreground">
            Manage your sailing routes and passage plans
          </p>
        </div>
        <Button onClick={handleNewPassage}>
          <Plus className="mr-2 h-4 w-4" />
          New Passage
        </Button>
      </div>

      {/* Filters and Search */}
      <PassageFilters
        searchQuery={searchQuery}
        onSearchChange={(value) =>
          dispatchFilter({ type: "searchChanged", value })
        }
        statusFilter={statusFilter}
        onStatusFilterChange={(value) =>
          dispatchFilter({ type: "statusChanged", value })
        }
        sortBy={sortBy}
        onSortByChange={(value) =>
          dispatchFilter({ type: "sortChanged", value })
        }
        selectedCount={selectedPassages.size}
        onBulkExport={handleBulkExport}
      />

      {/* Passages List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPassages.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery || statusFilter !== "all"
                ? "No passages found"
                : "No passages yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Start planning your first sailing adventure"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button onClick={handleNewPassage}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Passage
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPassages.map((passage) => (
            <PassageCard
              key={passage.id}
              passage={passage}
              selected={selectedPassages.has(passage.id)}
              onToggleSelect={togglePassageSelection}
              onView={handleViewPassage}
              onEdit={handleEditPassage}
              onDelete={handleDeletePassage}
            />
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {!loading && passages.length > 0 && (
        <PassageSummaryStats passages={passages} />
      )}
    </div>
  );
}

export default function PassagesPageClient() {
  return (
    <RequireAuth>
      <PassagesPageInner />
    </RequireAuth>
  );
}

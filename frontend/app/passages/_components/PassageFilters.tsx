"use client";

import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Search, Filter, Download, ArrowUpDown } from "lucide-react";
import { features } from "../../lib/features";

type SortOption = "date" | "name" | "distance" | "status";
type FilterStatus = "all" | "draft" | "planned" | "completed";

interface PassageFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: FilterStatus;
  onStatusFilterChange: (value: FilterStatus) => void;
  sortBy: SortOption;
  onSortByChange: (value: SortOption) => void;
  selectedCount: number;
  onBulkExport: () => void;
}

export function PassageFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  selectedCount,
  onBulkExport,
}: PassageFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search passages..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value: FilterStatus) => onStatusFilterChange(value)}
          >
            <SelectTrigger className="w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(value: SortOption) => onSortByChange(value)}
          >
            <SelectTrigger className="w-[150px]">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="distance">Distance</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>

          {features.bulkExport && selectedCount > 0 && (
            <Button variant="outline" onClick={onBulkExport}>
              <Download className="mr-2 h-4 w-4" />
              Export ({selectedCount})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

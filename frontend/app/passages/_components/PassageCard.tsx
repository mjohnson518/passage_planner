"use client";

import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Map,
  Calendar,
  Clock,
  Navigation,
  Trash2,
  Edit,
  Eye,
  Ship,
} from "lucide-react";
import { features } from "../../lib/features";

export interface Passage {
  id: string;
  name: string;
  departure: string;
  destination: string;
  departureDate: string;
  distanceNm: number;
  estimatedDuration: string;
  status: "draft" | "planned" | "completed";
  weatherSummary: string;
  boatName?: string;
  createdAt: string;
  updatedAt: string;
}

interface PassageCardProps {
  passage: Passage;
  selected: boolean;
  onToggleSelect: (passageId: string) => void;
  onView: (passageId: string) => void;
  onEdit: (passageId: string) => void;
  onDelete: (passageId: string) => void;
}

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    draft: "outline",
    planned: "default",
    completed: "secondary",
  };

  return (
    <Badge variant={variants[status] || "outline"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PassageCard({
  passage,
  selected,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
}: PassageCardProps) {
  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <input
              type="checkbox"
              aria-label={`Select passage ${passage.name}`}
              checked={selected}
              onChange={() => onToggleSelect(passage.id)}
              className="mt-1"
            />

            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <button
                    type="button"
                    className="text-lg font-semibold hover:text-primary cursor-pointer transition-colors text-left"
                    onClick={() => onView(passage.id)}
                  >
                    {passage.name}
                  </button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Navigation className="h-3 w-3" />
                    {passage.departure} → {passage.destination}
                  </div>
                </div>
                {getStatusBadge(passage.status)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mt-4">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(passage.departureDate)}
                </div>
                <div className="flex items-center gap-1">
                  <Map className="h-3 w-3" />
                  {passage.distanceNm} nm
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {passage.estimatedDuration}
                </div>
                {passage.boatName && (
                  <div className="flex items-center gap-1">
                    <Ship className="h-3 w-3" />
                    {passage.boatName}
                  </div>
                )}
              </div>

              <div className="mt-3 text-sm text-muted-foreground">
                {passage.weatherSummary}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onView(passage.id)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(passage.id)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            {features.passageDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(passage.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

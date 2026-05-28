"use client";

import { useReducer, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";
import { Share2, Route, Calendar, Ship, Users } from "lucide-react";
import { toast } from "sonner";
import type { FleetVessel, CrewMember } from "@/types/shared";
import { logger } from "../../lib/logger";

interface SharePassageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fleetId: string;
  vessels: FleetVessel[];
  members: CrewMember[];
}

interface UserPassage {
  id: string;
  departure: string;
  destination: string;
  departureTime: string;
  distance?: number;
  createdAt: string;
}

interface ShareFormState {
  selectedPassage: string;
  selectedVessels: string[];
  selectedMembers: string[];
  shareWithAll: boolean;
}

type ShareFormAction =
  | { type: "setPassage"; passage: string }
  | { type: "setShareWithAll"; value: boolean }
  | { type: "toggleVessel"; id: string; checked: boolean }
  | { type: "toggleMember"; id: string; checked: boolean }
  | { type: "reset" };

const initialShareForm: ShareFormState = {
  selectedPassage: "",
  selectedVessels: [],
  selectedMembers: [],
  shareWithAll: true,
};

function shareFormReducer(
  state: ShareFormState,
  action: ShareFormAction,
): ShareFormState {
  switch (action.type) {
    case "setPassage":
      return { ...state, selectedPassage: action.passage };
    case "setShareWithAll":
      return { ...state, shareWithAll: action.value };
    case "toggleVessel":
      return {
        ...state,
        selectedVessels: action.checked
          ? [...state.selectedVessels, action.id]
          : state.selectedVessels.filter((id) => id !== action.id),
      };
    case "toggleMember":
      return {
        ...state,
        selectedMembers: action.checked
          ? [...state.selectedMembers, action.id]
          : state.selectedMembers.filter((id) => id !== action.id),
      };
    case "reset":
      return initialShareForm;
    default:
      return state;
  }
}

export function SharePassageDialog({
  open,
  onOpenChange,
  fleetId,
  vessels,
  members,
}: SharePassageDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, dispatch] = useReducer(shareFormReducer, initialShareForm);
  const { selectedPassage, selectedVessels, selectedMembers, shareWithAll } =
    form;

  const { data: passages = [] } = useQuery<UserPassage[]>({
    queryKey: ["fleet-share-passages"],
    enabled: open,
    queryFn: async () => {
      try {
        const response = await fetch("/api/passages", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          return data.passages || [];
        }
        return [];
      } catch (error) {
        logger.error("Failed to fetch passages for share dialog", {
          error: String(error),
          fleetId,
        });
        toast.error("Failed to load passages");
        return [];
      }
    },
  });

  const handleSubmit = async () => {
    if (!selectedPassage) {
      toast.error("Please select a passage to share");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/fleet/${fleetId}/passages/share`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passageId: selectedPassage,
          vesselIds: shareWithAll ? undefined : selectedVessels,
          memberIds: shareWithAll ? undefined : selectedMembers,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to share passage");
      }

      toast.success("Passage shared successfully!");
      onOpenChange(false);

      // Reset form
      dispatch({ type: "reset" });
    } catch (error) {
      toast.error("Failed to share passage");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Passage with Fleet
          </DialogTitle>
          <DialogDescription>
            Share one of your passage plans with your fleet members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Passage</Label>
            <Select
              value={selectedPassage}
              onValueChange={(value) =>
                dispatch({ type: "setPassage", passage: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a passage to share" />
              </SelectTrigger>
              <SelectContent>
                {passages.map((passage) => (
                  <SelectItem key={passage.id} value={passage.id}>
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      <span>
                        {passage.departure} → {passage.destination}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        ({formatDate(passage.departureTime)})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-x-2">
              <Checkbox
                id="shareWithAll"
                checked={shareWithAll}
                onCheckedChange={(checked) =>
                  dispatch({
                    type: "setShareWithAll",
                    value: checked as boolean,
                  })
                }
              />
              <Label htmlFor="shareWithAll">Share with entire fleet</Label>
            </div>
          </div>

          {!shareWithAll && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Ship className="h-4 w-4" />
                  Select Vessels
                </Label>
                <ScrollArea className="h-32 border rounded-md p-3">
                  {vessels.map((vessel) => (
                    <div
                      key={vessel.id}
                      className="flex items-center gap-x-2 py-1"
                    >
                      <Checkbox
                        id={`vessel-${vessel.id}`}
                        checked={selectedVessels.includes(vessel.id)}
                        onCheckedChange={(checked) =>
                          dispatch({
                            type: "toggleVessel",
                            id: vessel.id,
                            checked: !!checked,
                          })
                        }
                      />
                      <Label
                        htmlFor={`vessel-${vessel.id}`}
                        className="font-normal cursor-pointer"
                      >
                        {vessel.name}{" "}
                        {vessel.callSign && `(${vessel.callSign})`}
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Select Crew Members
                </Label>
                <ScrollArea className="h-32 border rounded-md p-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-x-2 py-1"
                    >
                      <Checkbox
                        id={`member-${member.id}`}
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={(checked) =>
                          dispatch({
                            type: "toggleMember",
                            id: member.id,
                            checked: !!checked,
                          })
                        }
                      />
                      <Label
                        htmlFor={`member-${member.id}`}
                        className="font-normal cursor-pointer"
                      >
                        {member.name} ({member.role})
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedPassage}>
            {loading ? "Sharing..." : "Share Passage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

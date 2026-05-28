"use client";

import { Ship, Users, BarChart3, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { FleetVesselCard } from "../../components/fleet/FleetVesselCard";
import { CrewList } from "../../components/fleet/CrewList";
import { LazyFleetAnalytics } from "../../components/LazyComponents";
import type { Fleet, FleetMember, FleetVessel } from "./fleet-types";

interface FleetTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  fleet: Fleet;
  vessels: FleetVessel[];
  members: FleetMember[];
  isAdmin: boolean;
  canManage: boolean;
  onAddVessel: () => void;
  onInviteCrew: () => void;
  onVesselsUpdate: () => void;
  onMembersUpdate: () => void;
}

export function FleetTabs({
  activeTab,
  onTabChange,
  fleet,
  vessels,
  members,
  isAdmin,
  canManage,
  onAddVessel,
  onInviteCrew,
  onVesselsUpdate,
  onMembersUpdate,
}: FleetTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="vessels">
          <Ship className="mr-2 h-4 w-4" />
          Vessels ({vessels.length})
        </TabsTrigger>
        <TabsTrigger value="crew">
          <Users className="mr-2 h-4 w-4" />
          Crew ({members.length})
        </TabsTrigger>
        <TabsTrigger value="analytics">
          <BarChart3 className="mr-2 h-4 w-4" />
          Analytics
        </TabsTrigger>
      </TabsList>

      <TabsContent value="vessels" className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Fleet Vessels</h2>
          {canManage && (
            <Button onClick={onAddVessel}>
              <Plus className="mr-2 h-4 w-4" />
              Add Vessel
            </Button>
          )}
        </div>

        {vessels.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Ship className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No vessels in your fleet yet
              </p>
              {canManage && (
                <Button onClick={onAddVessel}>Add Your First Vessel</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vessels.map((vessel) => (
              <FleetVesselCard
                key={vessel.id}
                vessel={vessel}
                canEdit={canManage}
                onUpdate={onVesselsUpdate}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="crew" className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Crew Members</h2>
          {isAdmin && (
            <Button onClick={onInviteCrew}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Crew
            </Button>
          )}
        </div>

        <CrewList
          members={members}
          vessels={vessels}
          isAdmin={isAdmin}
          onUpdate={onMembersUpdate}
        />
      </TabsContent>

      <TabsContent value="analytics" className="mt-6">
        <LazyFleetAnalytics
          fleetId={fleet.id}
          vessels={vessels}
          members={members}
        />
      </TabsContent>
    </Tabs>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  LazyAdminOverview,
  LazyUserManagement,
  LazyRevenueMetrics,
  LazySystemHealth,
  LazyAgentMonitoring,
  LazyAnalyticsReports,
} from "../components/LazyComponents";
import {
  BarChart3,
  Users,
  DollarSign,
  Activity,
  Bot,
  FileBarChart,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { push } = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // Admin verification is async server state, so it's owned by react-query
  // rather than a hand-rolled loading flag.
  const { isPending, isError, isSuccess } = useQuery({
    queryKey: ["admin-verify", user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/admin/verify", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("forbidden");
      return true;
    },
  });

  useEffect(() => {
    if (!user) push("/login");
  }, [user, push]);

  useEffect(() => {
    if (isError) {
      toast.error("Admin access required");
      push("/dashboard");
    }
  }, [isError, push]);

  // Show the verifying state until we have a definitive grant; every failure
  // path redirects away.
  const loading = !user || isPending || isError;
  const adminVerified = isSuccess && !!user;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Verifying admin access…</p>
        </div>
      </div>
    );
  }

  if (!adminVerified) {
    return null;
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "revenue", label: "Revenue", icon: DollarSign },
    { id: "users", label: "Users", icon: Users },
    { id: "system", label: "System Health", icon: Activity },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "analytics", label: "Analytics", icon: FileBarChart },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your SaaS metrics and system health
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <LazyAdminOverview />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <LazyRevenueMetrics />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <LazyUserManagement />
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <LazySystemHealth />
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <LazyAgentMonitoring />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <LazyAnalyticsReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}

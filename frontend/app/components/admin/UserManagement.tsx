"use client";

import { useReducer, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";
import type { User } from "./_components/user-management-types";
import { UserTable } from "./_components/UserTable";
import { EditUserDialog } from "./_components/EditUserDialog";

interface FilterState {
  searchTerm: string;
  filterStatus: string;
  filterTier: string;
}

type FilterAction =
  | { type: "setSearchTerm"; value: string }
  | { type: "setFilterStatus"; value: string }
  | { type: "setFilterTier"; value: string };

const initialFilters: FilterState = {
  searchTerm: "",
  filterStatus: "all",
  filterTier: "all",
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "setSearchTerm":
      return { ...state, searchTerm: action.value };
    case "setFilterStatus":
      return { ...state, filterStatus: action.value };
    case "setFilterTier":
      return { ...state, filterTier: action.value };
    default:
      return state;
  }
}

export function UserManagement() {
  const [filters, dispatch] = useReducer(filterReducer, initialFilters);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const {
    data: users = [],
    isLoading: loading,
    refetch: refetchUsers,
  } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/users");
        if (!response.ok) throw new Error("Failed to fetch users");
        const data = await response.json();
        return data.users;
      } catch (error) {
        toast.error("Failed to load users");
        throw error;
      }
    },
  });

  const { searchTerm, filterStatus, filterTier } = filters;

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || user.status === filterStatus;
    const matchesTier =
      filterTier === "all" || user.subscription.tier === filterTier;
    return matchesSearch && matchesStatus && matchesTier;
  });

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update user status");

      toast.success("User status updated");
      refetchUsers();
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error("Failed to update user role");

      toast.success("User role updated");
      refetchUsers();
    } catch (error) {
      toast.error("Failed to update user role");
    }
  };

  const sendEmail = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Message from Helmwise",
          template: "admin-message",
        }),
      });

      if (!response.ok) throw new Error("Failed to send email");

      toast.success("Email sent successfully");
    } catch (error) {
      toast.error("Failed to send email");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user accounts, subscriptions, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) =>
                  dispatch({ type: "setSearchTerm", value: e.target.value })
                }
                className="pl-10"
              />
            </div>

            <Select
              value={filterStatus}
              onValueChange={(value) =>
                dispatch({ type: "setFilterStatus", value })
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterTier}
              onValueChange={(value) =>
                dispatch({ type: "setFilterTier", value })
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>

            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>

          <UserTable
            users={filteredUsers}
            onSendEmail={sendEmail}
            onEdit={(user) => {
              setSelectedUser(user);
              setShowEditDialog(true);
            }}
          />
        </CardContent>
      </Card>

      <EditUserDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        user={selectedUser}
        onRoleChange={handleRoleChange}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

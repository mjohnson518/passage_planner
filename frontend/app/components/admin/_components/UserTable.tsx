"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Mail, MoreVertical, Ban, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import type { User } from "./user-management-types";

interface UserTableProps {
  users: User[];
  onSendEmail: (userId: string) => void;
  onEdit: (user: User) => void;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-success" />;
    case "suspended":
      return <Ban className="h-4 w-4 text-warning" />;
    default:
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTierBadge(tier: string) {
  const variants: Record<string, any> = {
    free: "secondary",
    pro: "default",
    enterprise: "destructive",
  };
  return (
    <Badge variant={variants[tier] || "secondary"}>{tier.toUpperCase()}</Badge>
  );
}

export function UserTable({ users, onSendEmail, onEdit }: UserTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Passages</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{user.name || "Unnamed"}</div>
                  <div className="text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  {user.role === "admin" && (
                    <Badge variant="outline" className="mt-1">
                      Admin
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getStatusIcon(user.status)}
                  <span className="capitalize">{user.status}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {getTierBadge(user.subscription.tier)}
                  <div className="text-xs text-muted-foreground">
                    {user.subscription.status}
                  </div>
                </div>
              </TableCell>
              <TableCell>{user.passageCount}</TableCell>
              <TableCell>
                {format(new Date(user.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                {format(new Date(user.lastActiveAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onSendEmail(user.id)}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(user)}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

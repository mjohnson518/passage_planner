"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { TrendingUp, TrendingDown, Wind } from "lucide-react";

interface PopularRoute {
  from: string;
  to: string;
  count: number;
  avgDistance: number;
  avgDuration: number;
}

interface PopularRoutesTableProps {
  routes: PopularRoute[];
}

export function PopularRoutesTable({ routes }: PopularRoutesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Popular Routes</CardTitle>
        <CardDescription>Most frequently planned passages</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Count</TableHead>
              <TableHead>Avg Distance</TableHead>
              <TableHead>Avg Duration</TableHead>
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.slice(0, 10).map((route, idx) => (
              <TableRow key={`${route.from}-${route.to}`}>
                <TableCell>
                  <div className="font-medium">
                    {route.from} → {route.to}
                  </div>
                </TableCell>
                <TableCell>{route.count}</TableCell>
                <TableCell>{route.avgDistance.toFixed(1)} nm</TableCell>
                <TableCell>
                  {(route.avgDuration / 24).toFixed(1)} days
                </TableCell>
                <TableCell>
                  {idx < 3 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : idx > 6 ? (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  ) : (
                    <Wind className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

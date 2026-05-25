import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "./components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="h-8 w-8" />
        </div>
        <p className="font-mono-data text-xs uppercase tracking-widest text-muted-foreground mb-2">
          404 · Off course
        </p>
        <h1 className="text-3xl font-bold tracking-tight font-display mb-3">
          This heading isn&apos;t on the chart
        </h1>
        <p className="text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Plot a new course below.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/planner">Open planner</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

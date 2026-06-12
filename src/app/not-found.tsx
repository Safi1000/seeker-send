import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">This page could not be found.</p>
      <Button asChild className="mt-6">
        <Link href="/">Go to Dashboard</Link>
      </Button>
    </div>
  );
}

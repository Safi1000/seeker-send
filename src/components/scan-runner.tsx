"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

/**
 * Drives supplier scanning for an RFQ's still-PENDING items, one at a time.
 *
 * The list of pending items comes from the database (server-rendered), so this
 * is resumable: navigate away mid-scan and the items already done stay done;
 * come back and it picks up the remaining ones. Sequential (one browser at a
 * time) keeps memory in check for large RFQs.
 */
export function ScanRunner({ pendingItemIds }: { pendingItemIds: string[] }) {
  const router = useRouter();
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const [total] = useState(pendingItemIds.length);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(pendingItemIds.length > 0);

  useEffect(() => {
    mountedRef.current = true;
    if (startedRef.current || pendingItemIds.length === 0) return;
    startedRef.current = true;

    (async () => {
      let completed = 0;
      let sinceRefresh = 0;
      for (const id of pendingItemIds) {
        if (!mountedRef.current) return; // user navigated away — stop
        try {
          await fetch(`/api/items/${id}/search`, { method: "POST" });
        } catch {
          // leave it PENDING; a later visit will retry it
        }
        completed++;
        sinceRefresh++;
        if (mountedRef.current) setDone(completed);
        // Reveal new results periodically without hammering the DB.
        if (sinceRefresh >= 10) {
          sinceRefresh = 0;
          router.refresh();
        }
      }
      if (mountedRef.current) {
        setRunning(false);
        router.refresh();
      }
    })();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!running || total === 0) return null;

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Search className="h-4 w-4 animate-pulse text-primary" />
        Finding suppliers… {Math.min(done + 1, total)} of {total}
        <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
      </div>
      <Progress value={pct} />
      <p className="text-xs text-muted-foreground">
        Searching the web and verifying exact part-number matches. You can leave this page —
        progress is saved and resumes when you come back.
      </p>
    </Card>
  );
}

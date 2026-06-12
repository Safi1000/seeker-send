import { cn } from "@/lib/utils";
import type { SearchStatus, RfqStatus } from "@/lib/mock-data";

const map: Record<string, string> = {
  "Pending Search": "bg-muted text-muted-foreground border-border",
  "Found": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  "Inconclusive": "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  "Not Found": "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  "Ready To Send": "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  "Email Sent": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  "Email Failed": "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  "Processing": "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  "Ready": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  "Sent": "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
  "Partial": "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  "Failed": "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

export function StatusBadge({ status }: { status: SearchStatus | RfqStatus | string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        map[status] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
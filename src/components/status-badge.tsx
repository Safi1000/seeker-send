import { cn } from "@/lib/utils";
import type { ItemStatus } from "@/lib/types";

const STYLES: Record<ItemStatus, string> = {
  PENDING_SEARCH: "bg-muted text-muted-foreground border-border",
  FOUND: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  NOT_FOUND: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  READY_TO_SEND: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  EMAIL_SENT: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
  EMAIL_FAILED: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  PENDING_SEARCH: "Pending Search",
  FOUND: "Found",
  NOT_FOUND: "Not Found",
  READY_TO_SEND: "Ready to Send",
  EMAIL_SENT: "Email Sent",
  EMAIL_FAILED: "Email Failed",
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

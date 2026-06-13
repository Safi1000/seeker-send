"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Confirm-and-delete an RFQ (and all its items, suppliers, email logs and PDF).
 * `after`: "home" redirects to the dashboard (detail page); "refresh" reloads
 * the current route (list rows).
 */
export function DeleteRfqButton({
  rfqId,
  reference,
  after = "refresh",
  variant = "outline",
  label,
}: {
  rfqId: string;
  reference: string;
  after?: "home" | "refresh";
  variant?: "outline" | "ghost" | "destructive";
  label?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete RFQ");
        return;
      }
      toast.success(`Deleted ${reference} and all its data.`);
      if (after === "home") router.push("/");
      else router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant={variant}
          className={variant === "outline" ? "text-destructive hover:text-destructive" : undefined}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {label ? <span className="ml-1.5">{label}</span> : <span className="sr-only">Delete</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {reference}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the RFQ, all its extracted items, discovered suppliers, email
            logs, and the stored PDF. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

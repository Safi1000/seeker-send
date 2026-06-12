import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getRfq, getItemsForRfq } from "@/lib/repo";
import { Card } from "@/components/ui/card";
import { ItemsTable } from "@/components/items-table";

export const dynamic = "force-dynamic";

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ rfqId: string }>;
}) {
  const { rfqId } = await params;
  const rfq = await getRfq(rfqId);
  if (!rfq) notFound();
  const items = await getItemsForRfq(rfqId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <span>RFQ</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{rfq.reference_number}</h1>
          <p className="text-sm text-muted-foreground">
            Uploaded {new Date(rfq.uploaded_at).toLocaleString()} · {items.length} items
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No items extracted for this RFQ.
          </div>
        ) : (
          <ItemsTable items={items} />
        )}
      </Card>
    </div>
  );
}

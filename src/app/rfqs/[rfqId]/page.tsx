import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getRfq, getItemsWithSuppliersForRfq } from "@/lib/repo";
import { getOutlookStatus } from "@/lib/email/smtp";
import { groupItemsBySupplier } from "@/lib/grouping";
import { generateGroupEmail } from "@/lib/email/template";
import { Card } from "@/components/ui/card";
import { GroupedResults, type GroupView, type NoContactView } from "@/components/grouped-results";
import { DeleteRfqButton } from "@/components/delete-rfq-button";

export const dynamic = "force-dynamic";

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ rfqId: string }>;
}) {
  const { rfqId } = await params;
  const rfq = await getRfq(rfqId);
  if (!rfq) notFound();

  const itemsWithSuppliers = await getItemsWithSuppliersForRfq(rfqId);
  const { groups, noContact } = groupItemsBySupplier(itemsWithSuppliers);
  const outlook = await getOutlookStatus();

  const date = new Date().toLocaleDateString("en-GB");

  const groupViews: GroupView[] = groups.map((g) => {
    const items = g.entries.map((e) => e.item);
    const email = generateGroupEmail(items, rfq.reference_number, date);
    return {
      email: g.email,
      supplierName: g.supplierName,
      website: g.website,
      supplierId: g.supplierId,
      matchType: g.matchType,
      itemIds: items.map((i) => i.id),
      items: items
        .map((i) => ({
          id: i.id,
          item_number: i.item_number,
          part_number: i.part_number,
          product: i.product,
          quantity: i.quantity,
          unit: i.unit,
        }))
        .sort((a, b) => a.item_number - b.item_number),
      subject: email.subject,
      body: email.body,
      allSent: items.every((i) => i.status === "EMAIL_SENT"),
    };
  });

  const noContactViews: NoContactView[] = noContact.map((i) => ({
    id: i.id,
    item_number: i.item_number,
    part_number: i.part_number,
    product: i.product,
    status: i.status,
  }));

  const itemCount = itemsWithSuppliers.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <span>RFQ</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{rfq.reference_number}</h1>
            <p className="text-sm text-muted-foreground">
              Uploaded {new Date(rfq.uploaded_at).toLocaleString()} · {itemCount} items ·{" "}
              {groupViews.length} supplier {groupViews.length === 1 ? "group" : "groups"}
            </p>
          </div>
        </div>
        <DeleteRfqButton
          rfqId={rfq.id}
          reference={rfq.reference_number}
          after="home"
          label="Delete RFQ"
        />
      </div>

      {itemCount === 0 ? (
        <Card className="px-5 py-10 text-center text-sm text-muted-foreground">
          No items extracted for this RFQ.
        </Card>
      ) : (
        <GroupedResults
          groups={groupViews}
          noContact={noContactViews}
          mock={outlook.mock}
          configured={outlook.configured}
        />
      )}
    </div>
  );
}

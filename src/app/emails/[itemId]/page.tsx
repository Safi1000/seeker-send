import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem, getRfq, getSuppliersForItem } from "@/lib/repo";
import { generateEmail } from "@/lib/email/template";
import { getOutlookStatus } from "@/lib/email/graph";
import { EmailEditor } from "./email-editor";

export const dynamic = "force-dynamic";

export default async function EmailPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ supplier?: string }>;
}) {
  const { itemId } = await params;
  const { supplier } = await searchParams;

  const item = await getItem(itemId);
  if (!item) notFound();

  const [rfq, suppliers, outlook] = await Promise.all([
    getRfq(item.rfq_id),
    getSuppliersForItem(itemId),
    getOutlookStatus(),
  ]);

  const date = new Date().toLocaleDateString("en-GB");
  const email = generateEmail(item, rfq?.reference_number ?? "N/A", date);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <Link href={`/items/${item.id}`} className="hover:underline">
          Item {item.item_number}
        </Link>
        <span>/</span>
        <span>Email</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Preview</h1>
        <p className="text-sm text-muted-foreground">
          Review and edit the RFQ email. Nothing is sent until you click Send.
        </p>
      </div>

      <EmailEditor
        itemId={item.id}
        initialSubject={email.subject}
        initialBody={email.body}
        suppliers={suppliers}
        defaultSupplierId={supplier ?? null}
        outlookConnected={outlook.connected}
        mock={outlook.mock}
      />
    </div>
  );
}

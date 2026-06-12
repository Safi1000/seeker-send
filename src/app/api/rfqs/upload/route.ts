import { NextResponse } from "next/server";
import { extractItemsFromPdf } from "@/lib/pdf/extract";
import { storeRfqPdf } from "@/lib/storage";
import { createRfq, insertItems } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/rfqs/upload — multipart form with `file` (PDF). */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const refOverride = form.get("reference_number");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
    }
    if (file.type && !file.type.includes("pdf")) {
      return NextResponse.json({ error: "File must be a PDF." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // 1. Extract items from the PDF.
    const { items, method, rawTextLength } = await extractItemsFromPdf(bytes);
    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "No RFQ items could be extracted from this PDF. It may be empty, scanned without OCR support, or in an unexpected layout.",
          method,
          rawTextLength,
        },
        { status: 422 },
      );
    }

    // 2. Derive a reference number.
    const referenceNumber =
      (typeof refOverride === "string" && refOverride.trim()) ||
      deriveReferenceNumber(file.name);

    // 3. Persist file + rfq + items.
    const filePath = await storeRfqPdf(file.name, bytes);
    const rfq = await createRfq({ reference_number: referenceNumber, file_path: filePath });
    const created = await insertItems(rfq.id, items);

    return NextResponse.json({ rfq, items: created, method }, { status: 201 });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json(
      { error: "Failed to process RFQ upload.", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

function deriveReferenceNumber(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  if (base.length >= 4) return base.slice(0, 60);
  const y = new Date().getFullYear();
  return `RFQ-${y}-${Math.floor(Date.now() / 1000)
    .toString()
    .slice(-5)}`;
}

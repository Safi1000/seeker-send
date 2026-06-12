import "server-only";
import type { ExtractedItem } from "@/lib/types";
import { parseRfqItems } from "./parse-items";

/**
 * Extract text from an RFQ PDF and parse it into structured items.
 *
 * Strategy (cheapest first; OCR is only used when genuinely required):
 *   1. pdf-parse  — fast text layer extraction for normal digital PDFs.
 *   2. pdfjs-dist — fallback text extraction (handles some PDFs pdf-parse trips on).
 *   3. Tesseract  — OCR of rendered pages, only when the text layer is empty
 *      (i.e. a scanned/image-only PDF).
 */

const MIN_USEFUL_TEXT = 40; // chars; below this we assume no usable text layer

export interface ExtractionResult {
  items: ExtractedItem[];
  method: "pdf-parse" | "pdfjs" | "ocr";
  rawTextLength: number;
}

export async function extractItemsFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  let text = "";
  let method: ExtractionResult["method"] = "pdf-parse";

  // 1. pdf-parse
  try {
    // Import the implementation directly to avoid pdf-parse's debug-mode side effect.
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
      b: Buffer,
    ) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    text = parsed.text ?? "";
  } catch (err) {
    console.warn("[pdf] pdf-parse failed, falling back to pdfjs:", err);
  }

  // 2. pdfjs text fallback
  if (text.trim().length < MIN_USEFUL_TEXT) {
    try {
      const pdfjsText = await extractWithPdfjs(buffer);
      if (pdfjsText.trim().length > text.trim().length) {
        text = pdfjsText;
        method = "pdfjs";
      }
    } catch (err) {
      console.warn("[pdf] pdfjs text extraction failed:", err);
    }
  }

  // 3. OCR fallback (scanned PDFs only)
  if (text.trim().length < MIN_USEFUL_TEXT) {
    try {
      text = await ocrPdf(buffer);
      method = "ocr";
    } catch (err) {
      console.warn("[pdf] OCR failed:", err);
    }
  }

  const items = parseRfqItems(text);
  return { items, method, rawTextLength: text.trim().length };
}

// ---------------------------------------------------------------------------
// pdfjs-dist helpers
// ---------------------------------------------------------------------------

async function loadPdfjs() {
  // The legacy build runs in plain Node without a DOM.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs;
}

async function extractWithPdfjs(buffer: Buffer): Promise<string> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: unknown) => (it as { str?: string }).str ?? "")
      .join(" ");
    out += pageText + "\n";
  }
  await doc.destroy();
  return out;
}

// ---------------------------------------------------------------------------
// OCR (rendered pages -> Tesseract)
// ---------------------------------------------------------------------------

async function ocrPdf(buffer: Buffer): Promise<string> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await loadPdfjs();
  const { createWorker } = await import("tesseract.js");

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const worker = await createWorker("eng");
  try {
    let out = "";
    const maxPages = Math.min(doc.numPages, 10); // low-volume guard
    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      // pdfjs expects a canvas-like 2d context; @napi-rs/canvas is compatible.
      await page.render({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        canvasContext: ctx as any,
        viewport,
      }).promise;
      const png = canvas.toBuffer("image/png");
      const { data } = await worker.recognize(png);
      out += data.text + "\n";
    }
    await doc.destroy();
    return out;
  } finally {
    await worker.terminate();
  }
}

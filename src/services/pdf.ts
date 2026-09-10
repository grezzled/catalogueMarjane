import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

export interface PDFPage {
  pageNumber: number;
  text: string;
  imagePath?: string;
}

export async function extractPDFText(
  buffer: Buffer
): Promise<{ text: string; pageCount: number; pages: PDFPage[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
  );
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerPath;

  const { PDFParse } = await import("pdf-parse");

  const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
  await (parser as any).load();

  const info = await parser.getInfo();
  const pageCount: number = info.total || 1;

  const result = await parser.getText();
  const fullText: string = result.text || "";

  const pages: PDFPage[] = [];
  if (result.pages && Array.isArray(result.pages)) {
    for (const p of result.pages) {
      pages.push({
        pageNumber: p.num || pages.length + 1,
        text: p.text || "",
      });
    }
  } else {
    const pageTexts = splitTextByPages(fullText, pageCount);
    for (let i = 0; i < pageCount; i++) {
      pages.push({ pageNumber: i + 1, text: pageTexts[i] || "" });
    }
  }

  return { text: fullText, pageCount, pages };
}

function splitTextByPages(text: string, pageCount: number): string[] {
  const lines = text.split("\n");
  const avgLinesPerPage = Math.ceil(lines.length / pageCount) || 1;
  const pages: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const start = i * avgLinesPerPage;
    const end = Math.min((i + 1) * avgLinesPerPage, lines.length);
    pages.push(lines.slice(start, end).join("\n"));
  }

  return pages;
}

export async function renderPDFPages(
  pdfBuffer: Buffer,
  catalogueId: string,
  pageCount: number
): Promise<{ pageNumber: number; imagePath: string }[]> {
  const uploadDir = path.join(process.cwd(), "uploads", catalogueId);
  const pagesDir = path.join(uploadDir, "pages");
  await fs.mkdir(pagesDir, { recursive: true });

  const results: { pageNumber: number; imagePath: string }[] = [];
  const tempPdf = path.join(uploadDir, "temp.pdf");
  await fs.writeFile(tempPdf, pdfBuffer);

  const { execSync } = await import("child_process");

  try {
    execSync(
      `pdftoppm -jpeg -r 200 "${tempPdf}" "${path.join(pagesDir, "page")}"`,
      { timeout: 120000 }
    );

    for (let i = 1; i <= pageCount; i++) {
      const imagePath = path.join(pagesDir, `page-${String(i).padStart(2, "0")}.jpg`);
      try {
        await fs.access(imagePath);
        results.push({ pageNumber: i, imagePath });
      } catch {
        console.warn(`Page ${i} image not found, skipping`);
      }
    }
  } finally {
    try {
      await fs.unlink(tempPdf).catch(() => {});
    } catch {}
  }

  return results;
}

export async function imageToBase64(imagePath: string): Promise<string> {
  const buffer = await fs.readFile(imagePath);
  const resized = await sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return resized.toString("base64");
}

export async function computeFileHash(buffer: Buffer): Promise<string> {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

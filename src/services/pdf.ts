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
  const uploadDir = path.join(process.env.UPLOAD_DIR || "./public/uploads", catalogueId);
  const pagesDir = path.join(uploadDir, "pages");
  await fs.mkdir(pagesDir, { recursive: true });

  // Create the original (full-resolution) directory
  const originalDir = path.join(process.env.UPLOAD_DIR_ORIGINAL || "./uploads-original", catalogueId, "pages");
  await fs.mkdir(originalDir, { recursive: true });

  const results: { pageNumber: number; imagePath: string }[] = [];
  const tempPdf = path.join(uploadDir, "temp.pdf");
  await fs.writeFile(tempPdf, pdfBuffer);

  const { execSync } = await import("child_process");

  try {
    // Render PDF to JPEG at 200 DPI in the original directory (full resolution)
    execSync(
      `pdftoppm -jpeg -r 200 "${tempPdf}" "${path.join(originalDir, "page")}"`,
      { timeout: 120000 }
    );

    for (let i = 1; i <= pageCount; i++) {
      const paddedNum = String(i).padStart(2, "0");
      const originalJpgPath = path.join(originalDir, `page-${paddedNum}.jpg`);
      const webpPath = path.join(pagesDir, `page-${paddedNum}.webp`);
      try {
        await fs.access(originalJpgPath);
        // Convert original JPEG to WebP for public display
        const buffer = await fs.readFile(originalJpgPath);
        await sharp(buffer).webp({ quality: 80 }).toFile(webpPath);
        results.push({ pageNumber: i, imagePath: webpPath });
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

/**
 * Get the path to the original full-resolution page image for AI analysis.
 * Falls back to the WebP path if the original doesn't exist.
 */
export function getOriginalPageImagePath(
  webpImagePath: string,
  catalogueId?: string
): string {
  // Try to derive the original path from the webp path
  if (catalogueId) {
    const originalDir = path.join(
      process.env.UPLOAD_DIR_ORIGINAL || "./uploads-original",
      catalogueId,
      "pages"
    );
    // Extract the page number from the webp filename (e.g., "page-01.webp" -> "page-01")
    const basename = path.basename(webpImagePath, ".webp");
    const originalPath = path.join(originalDir, `${basename}.jpg`);
    return originalPath;
  }

  // Fallback: try to find the original by replacing path segments
  const originalBase = webpImagePath
    .replace(/\/public\/uploads\//, "/uploads-original/")
    .replace(/\.webp$/, ".jpg");
  return originalBase;
}

export async function imageToBase64(
  imagePath: string,
  catalogueId?: string
): Promise<string> {
  // Try to use the original full-resolution image for AI analysis
  const originalPath = getOriginalPageImagePath(imagePath, catalogueId);
  let readPath = imagePath;
  try {
    await fs.access(originalPath);
    readPath = originalPath;
  } catch {
    // Original not found, use the provided path
  }

  const buffer = await fs.readFile(readPath);
  const resized = await sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return resized.toString("base64");
}

export async function computeFileHash(buffer: Buffer): Promise<string> {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

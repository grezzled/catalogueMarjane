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

/**
 * pdftoppm zero-pads output names to the digit width of the page count:
 * 8 pages  -> page-1.jpg … page-8.jpg (no padding),
 * 48 pages -> page-01.jpg … page-48.jpg,
 * 100+     -> page-001.jpg …
 * Try every plausible name so rendering works for any catalogue size.
 */
function originalNameCandidates(pageNumber: number): string[] {
  const names = new Set<string>();
  names.add(`page-${pageNumber}.jpg`);
  names.add(`page-${String(pageNumber).padStart(2, "0")}.jpg`);
  names.add(`page-${String(pageNumber).padStart(3, "0")}.jpg`);
  return [...names];
}

async function findOriginalJpg(originalDir: string, pageNumber: number): Promise<string | null> {
  for (const name of originalNameCandidates(pageNumber)) {
    const candidate = path.join(originalDir, name);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
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
      const webpPath = path.join(pagesDir, `page-${paddedNum}.webp`);
      const originalJpgPath = await findOriginalJpg(originalDir, i);
      if (!originalJpgPath) {
        console.warn(`Page ${i} image not found, skipping`);
        continue;
      }
      try {
        // Convert original JPEG to WebP for public display
        const buffer = await fs.readFile(originalJpgPath);
        await sharp(buffer).webp({ quality: 80 }).toFile(webpPath);
        results.push({ pageNumber: i, imagePath: webpPath });
      } catch (err) {
        console.warn(`Page ${i} image conversion failed, skipping:`, err);
      }
    }
    if (results.length === 0 && pageCount > 0) {
      console.error(
        `renderPDFPages: 0 of ${pageCount} pages rendered for catalogue ${catalogueId} — check pdftoppm output in ${originalDir}`
      );
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
  // Try to use the original full-resolution image for AI analysis.
  // The webp basename may be zero-padded (page-01) while pdftoppm wrote
  // the original unpadded (page-1) for <10-page catalogues — try all.
  let readPath = imagePath;
  if (catalogueId) {
    const pageMatch = path.basename(imagePath).match(/(\d+)/);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : NaN;
    if (!Number.isNaN(pageNumber)) {
      const originalDir = path.join(
        process.env.UPLOAD_DIR_ORIGINAL || "./uploads-original",
        catalogueId,
        "pages"
      );
      const found = await findOriginalJpg(originalDir, pageNumber);
      if (found) readPath = found;
    }
  }
  if (readPath === imagePath) {
    const originalPath = getOriginalPageImagePath(imagePath, catalogueId);
    try {
      await fs.access(originalPath);
      readPath = originalPath;
    } catch {
      // Original not found, use the provided path
    }
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

/**
 * Resolve a stored pdfPath to a readable file. Catalogues created before
 * UPLOAD_DIR moved under ./public store paths like `uploads/<id>/...`
 * while the files live in `public/uploads/<id>/...` — try both.
 * Returns null when neither exists.
 */
export async function resolvePdfPath(storedPath: string | null): Promise<string | null> {
  if (!storedPath) return null;
  const candidates = [storedPath];
  if (!storedPath.startsWith("public/")) {
    candidates.push(path.join("public", storedPath));
  }
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

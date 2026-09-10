import sharp from "sharp";
import { mkdir, access } from "fs/promises";
import { dirname, join, basename } from "path";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Get the path to the original full-resolution page image for cropping.
 */
function getOriginalPageImagePath(pageImagePath: string, catalogueId?: string): string {
  if (catalogueId) {
    const basename = pageImagePath.replace(/\.webp$/, ".jpg").split("/").pop();
    return join(
      process.env.UPLOAD_DIR_ORIGINAL || "./uploads-original",
      catalogueId,
      "pages",
      basename || "page-01.jpg"
    );
  }
  return pageImagePath;
}

export async function cropProductImage(
  pageImagePath: string,
  boundingBox: BoundingBox,
  outputPath: string,
  catalogueId?: string
): Promise<string | null> {
  try {
    // Use the original full-resolution image for cropping if available
    const originalPath = getOriginalPageImagePath(pageImagePath, catalogueId);
    let sourcePath = pageImagePath;
    try {
      await access(originalPath);
      sourcePath = originalPath;
    } catch {
      // Original not found, use the provided path
    }

    const metadata = await sharp(sourcePath).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    if (!imgWidth || !imgHeight) return null;

    const left = Math.round(boundingBox.x * imgWidth);
    const top = Math.round(boundingBox.y * imgHeight);
    const width = Math.round(boundingBox.width * imgWidth);
    const height = Math.round(boundingBox.height * imgHeight);

    const safeLeft = Math.max(0, Math.min(left, imgWidth - 1));
    const safeTop = Math.max(0, Math.min(top, imgHeight - 1));
    const safeWidth = Math.min(width, imgWidth - safeLeft);
    const safeHeight = Math.min(height, imgHeight - safeTop);

    if (safeWidth < 10 || safeHeight < 10) return null;

    await mkdir(dirname(outputPath), { recursive: true });

    await sharp(sourcePath)
      .extract({
        left: safeLeft,
        top: safeTop,
        width: safeWidth,
        height: safeHeight,
      })
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return outputPath;
  } catch (err) {
    console.warn(`Failed to crop product image: ${err}`);
    return null;
  }
}

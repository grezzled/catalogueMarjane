import sharp from "sharp";
import { mkdir } from "fs/promises";
import { dirname } from "path";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function cropProductImage(
  pageImagePath: string,
  boundingBox: BoundingBox,
  outputPath: string
): Promise<string | null> {
  try {
    const metadata = await sharp(pageImagePath).metadata();
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

    await sharp(pageImagePath)
      .extract({
        left: safeLeft,
        top: safeTop,
        width: safeWidth,
        height: safeHeight,
      })
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    return outputPath;
  } catch (err) {
    console.warn(`Failed to crop product image: ${err}`);
    return null;
  }
}

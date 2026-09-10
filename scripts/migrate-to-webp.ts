import sharp from "sharp";
import { readdir, readFile, unlink, stat } from "fs/promises";
import { join, extname } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function convertJpgToWebp(filePath: string): Promise<string> {
  const webpPath = filePath.replace(/\.jpg$/, ".webp");
  const buffer = await readFile(filePath);
  await sharp(buffer).webp({ quality: 80 }).toFile(webpPath);
  await unlink(filePath);
  return webpPath;
}

async function processDirectory(dir: string): Promise<number> {
  let converted = 0;
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      converted += await processDirectory(fullPath);
    } else if (entry.name.endsWith(".jpg")) {
      try {
        await convertJpgToWebp(fullPath);
        converted++;
        console.log(`Converted: ${fullPath}`);
      } catch (err) {
        console.error(`Failed to convert ${fullPath}: ${err}`);
      }
    }
  }
  return converted;
}

async function updateDatabasePaths() {
  console.log("\nUpdating database paths...");

  const pages = await prisma.cataloguePage.findMany({
    where: { imagePath: { contains: ".jpg" } },
  });

  for (const page of pages) {
    if (page.imagePath?.endsWith(".jpg")) {
      const newPath = page.imagePath.replace(/\.jpg$/, ".webp");
      await prisma.cataloguePage.update({
        where: { id: page.id },
        data: { imagePath: newPath },
      });
      console.log(`Updated page ${page.id}: .jpg → .webp`);
    }
  }

  const products = await prisma.product.findMany({
    where: { imageUrl: { contains: ".jpg" } },
  });

  for (const product of products) {
    if (product.imageUrl?.endsWith(".jpg")) {
      const newPath = product.imageUrl.replace(/\.jpg$/, ".webp");
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: newPath },
      });
      console.log(`Updated product ${product.id}: .jpg → .webp`);
    }
  }

  console.log(`Updated ${pages.length} pages and ${products.length} products in database`);
}

async function main() {
  const uploadsDir = join(process.cwd(), "public/uploads");

  console.log("Converting JPG images to WebP...");
  const converted = await processDirectory(uploadsDir);
  console.log(`\nConverted ${converted} images to WebP`);

  await updateDatabasePaths();

  console.log("\nMigration complete!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

import sharp from "sharp";
import path from "path";
import fs from "fs";

/**
 * Convert image (path or Buffer) to WebP format.
 * @param {string|Buffer} input - Path to source image file or Buffer with image data.
 * @param {string} outputDir - Directory to save WebP file.
 * @param {string} [filenameBase] - Base name (without ext) for output file. If not provided, timestamp used.
 * @returns {Promise<string>} - Path to saved WebP file.
 */
export async function convertToWebp(input, outputDir, filenameBase) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const base = filenameBase ? String(filenameBase).replace(/[^a-z0-9_\-]/gi, "_") : `${Date.now()}`;
  const outputPath = path.join(outputDir, `${base}.webp`);

  // sharp accepts Buffer or filepath
  await sharp(input).webp({ quality: 80 }).toFile(outputPath);

  return outputPath;
}
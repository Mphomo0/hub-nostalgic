import sharp from "sharp";
import { LOGO_MAX_UPLOAD_BYTES, LOGO_MAX_WIDTH } from "@/lib/config";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_FORMATS = new Set(["png", "jpeg", "webp"]);

export class LogoError extends Error {}

/**
 * Validate and shrink an uploaded logo (build plan section 9).
 * - PNG / JPG / WebP only. SVG is rejected because it can contain scripts.
 * - Max 500 KB upload.
 * - Resized to max 400px wide and re-encoded as WebP, which also strips metadata.
 */
export async function processLogo(file: File): Promise<{ data: Uint8Array<ArrayBuffer>; contentType: string; sizeBytes: number }> {
  if (file.size === 0) throw new LogoError("The file is empty.");
  if (file.size > LOGO_MAX_UPLOAD_BYTES) throw new LogoError("Logo must be 500 KB or smaller.");
  if (!ALLOWED.has(file.type)) throw new LogoError("Logo must be a PNG, JPG or WebP image.");

  const input = Buffer.from(await file.arrayBuffer());
  // Don't trust the browser's file type: check what the bytes actually are.
  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.format || !ALLOWED_FORMATS.has(meta.format)) throw new LogoError("That file isn't a valid PNG, JPG or WebP image.");

  const output = await sharp(input)
    .rotate()
    .resize({ width: LOGO_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  // Copy into a plain Uint8Array (what Prisma expects for Bytes columns).
  const data = new Uint8Array(output);
  return { data, contentType: "image/webp", sizeBytes: data.length };
}

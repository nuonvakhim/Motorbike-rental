/**
 * Turning an uploaded file into a photo we are willing to store and serve.
 *
 * Nothing from the upload is kept as-is. `sharp` decodes it, and only if it
 * really is a JPEG, PNG or WebP is it rotated upright, scaled down and
 * re-encoded as WebP. Re-encoding is the safety step: it drops EXIF metadata
 * (phones embed the GPS location of the shop, sometimes of the owner's home)
 * and it means a file that merely *claims* to be an image — an SVG with a
 * script inside, an HTML page renamed .jpg — never reaches another browser.
 *
 * The `file.type` the browser sends is ignored; it is whatever the client
 * says it is.
 */

import "server-only";

import sharp from "sharp";

/** Largest upload accepted per file, before processing. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Photos kept per bike. */
export const MAX_PHOTOS_PER_BIKE = 6;
/** Longest side of the stored image. Enough for a full-width hero on a laptop. */
const MAX_DIMENSION = 1600;
/**
 * Refuse images with more pixels than this before decoding them. A tiny PNG
 * can declare 50,000 × 50,000 pixels and exhaust memory when expanded — a
 * "decompression bomb". 40 megapixels covers any phone camera.
 */
const MAX_INPUT_PIXELS = 40_000_000;
/** Give up on a single image rather than tie up the server. */
const PROCESS_TIMEOUT_SECONDS = 15;

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ProcessedPhoto = {
  data: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  size: number;
};

export type ProcessResult =
  | { ok: true; photo: ProcessedPhoto }
  | { ok: false; error: string };

export async function processPhoto(file: File): Promise<ProcessResult> {
  if (file.size === 0) return { ok: false, error: `${file.name} is empty.` };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `${file.name} is larger than 8 MB.` };
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const { format } = await image.metadata();

    // `sharp` can also read SVG, GIF, TIFF, HEIF… Only accept what we mean to.
    if (!format || !ACCEPTED_FORMATS.has(format)) {
      return { ok: false, error: `${file.name} is not a JPG, PNG or WebP image.` };
    }

    const { data, info } = await image
      .autoOrient()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .timeout({ seconds: PROCESS_TIMEOUT_SECONDS })
      .toBuffer({ resolveWithObject: true });

    return {
      ok: true,
      photo: {
        data: new Uint8Array(data),
        width: info.width,
        height: info.height,
        size: info.size,
      },
    };
  } catch {
    return { ok: false, error: `${file.name} could not be read as an image.` };
  }
}

import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_SOURCE_IMAGE_BYTES } from "@commune/shared";

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** Some Android browsers leave File.type empty, so fall back to the file extension. */
function typeOf(file: File): string {
  if (file.type) return file.type;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext ? `image/${ext}` : "";
}

/** Quick check so people get instant feedback. The server validates again. */
export function validateImage(file: File): string | null {
  const type = typeOf(file);
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)) {
    return "Choose a PNG, JPEG, GIF or WebP image.";
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return `Photo must be ${mb(MAX_SOURCE_IMAGE_BYTES)} MB or smaller.`;
  }
  if (type === "image/gif" && file.size > MAX_IMAGE_BYTES) {
    return `GIFs must be ${mb(MAX_IMAGE_BYTES)} MB or smaller. Try a shorter one.`;
  }
  return null;
}

export interface PrepareOptions {
  /** Longest side in pixels after shrinking. */
  maxSide: number;
  /** Crop to a centred square (profile photos). */
  square?: boolean;
}

export const POST_PHOTO: PrepareOptions = { maxSide: 1600 };
export const AVATAR_PHOTO: PrepareOptions = { maxSide: 512, square: true };

const KEEP_BELOW_BYTES = 600 * 1024;
const TARGET_BYTES = 2.5 * 1024 * 1024;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall back to an <img> element below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("We couldn't read that image. Try another photo.");
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Shrinks a photo before upload: phone photos are often 5 to 12 MB, which is slow on mobile data
 * and larger than the server accepts. Output is WebP (JPEG where the browser cannot write WebP),
 * at most `maxSide` pixels, and normally a few hundred KB. GIFs are sent as they are, so they
 * keep their animation.
 */
export async function prepareImage(file: File, options: PrepareOptions): Promise<File> {
  const problem = validateImage(file);
  if (problem) throw new Error(problem);
  if (typeOf(file) === "image/gif") return file;

  const decoded = await decode(file);
  try {
    const { width, height } = decoded;
    const side = options.square ? Math.min(width, height) : Math.max(width, height);
    const scale = Math.min(1, options.maxSide / side);

    // Already small and the right shape: nothing to gain, keep the original bytes.
    if (scale === 1 && !options.square && file.size <= KEEP_BELOW_BYTES) return file;

    // Crop region in the source image.
    const sw = options.square ? Math.min(width, height) : width;
    const sh = options.square ? Math.min(width, height) : height;
    const sx = options.square ? (width - sw) / 2 : 0;
    const sy = options.square ? (height - sh) / 2 : 0;

    let outW = Math.max(1, Math.round(sw * scale));
    let outH = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement("canvas");

    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser can't prepare images. Try a smaller photo.");
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, outW, outH);
      ctx.drawImage(decoded.source, sx, sy, sw, sh, 0, 0, outW, outH);

      let blob = await toBlob(canvas, "image/webp", 0.82);
      let ext = "webp";
      if (!blob || blob.type !== "image/webp") {
        // No WebP encoder (older Safari): use JPEG on a white background.
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, outW, outH);
        blob = await toBlob(canvas, "image/jpeg", 0.85);
        ext = "jpg";
      }
      if (blob && blob.size <= TARGET_BYTES) {
        return new File([blob], `photo.${ext}`, { type: blob.type });
      }
      outW = Math.round(outW * 0.8);
      outH = Math.round(outH * 0.8);
    }
    throw new Error("That photo is too large to upload. Try a smaller one.");
  } finally {
    decoded.close();
  }
}

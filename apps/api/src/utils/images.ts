export type ImageExt = "png" | "jpg" | "gif" | "webp";

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

/**
 * Identifies an image by its leading "magic bytes" instead of trusting the filename or the
 * Content-Type header, both of which the client controls. Returns null for anything else.
 */
export function detectImageType(buf: Buffer): ImageExt | null {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return "gif"; // GIF87a
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "gif"; // GIF89a
  // WebP: "RIFF" <4 byte size> "WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "webp";
  }
  return null;
}

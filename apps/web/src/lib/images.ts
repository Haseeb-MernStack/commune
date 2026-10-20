import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@commune/shared";

/** Quick client-side check so people get instant feedback. The server validates again. */
export function validateImage(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a PNG, JPEG, GIF or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

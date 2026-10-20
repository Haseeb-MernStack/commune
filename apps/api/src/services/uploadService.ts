import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { uploadUrlSchema } from "@commune/shared";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import type { ImageExt } from "../utils/images.js";

/**
 * Storage layer. Today files live on local disk; to move to S3 or Cloudinary, replace
 * saveImage / deleteUpload and keep returning a URL string. Nothing else needs to change.
 */
export const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);

export async function saveImage(buffer: Buffer, ext: ImageExt): Promise<string> {
  await fs.mkdir(uploadDir, { recursive: true });
  // Random name: never use the client's filename.
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(uploadDir, name), buffer, { flag: "wx" });
  return `/uploads/${name}`;
}

/**
 * Deletes an uploaded file, but only if no post or profile still references it.
 * The reference check also stops someone from deleting another user's image by attaching
 * its (public) URL to their own post and then deleting that post.
 */
export async function deleteUploadIfUnused(url: string | null | undefined): Promise<void> {
  if (!url || !uploadUrlSchema.safeParse(url).success) return;
  try {
    const [usedByPost, usedByUser] = await Promise.all([
      Post.exists({ imageUrl: url }),
      User.exists({ avatarUrl: url }),
    ]);
    if (usedByPost || usedByUser) return;
    await fs.rm(path.join(uploadDir, path.basename(url)), { force: true });
  } catch (err) {
    logger.warn({ err, url }, "Failed to delete upload");
  }
}

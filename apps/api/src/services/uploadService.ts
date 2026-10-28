import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { uploadUrlSchema, type UploadTicket } from "@commune/shared";
import { env, isProd } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { AppError, badRequest } from "../utils/errors.js";
import type { ImageExt } from "../utils/images.js";

/**
 * Storage layer. Two backends, chosen by environment variables:
 *
 *  - local disk (default): files live in UPLOAD_DIR and are served by Express.
 *  - Cloudinary (when CLOUDINARY_* are all set): files are uploaded to Cloudinary and
 *    /uploads/<name> redirects there.
 *
 * Either way the app stores and returns the same "/uploads/<id>.<ext>" reference, so nothing
 * outside this file knows which backend is in use. To add S3 or another provider, add a branch
 * to saveStored / removeStored.
 */
export const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);

const cloud =
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
    ? {
        name: env.CLOUDINARY_CLOUD_NAME,
        key: env.CLOUDINARY_API_KEY,
        secret: env.CLOUDINARY_API_SECRET,
      }
    : null;

export const usesCloudStorage = cloud !== null;
const FOLDER = "commune";

if (isProd && !cloud) {
  logger.warn(
    "Uploads are stored on local disk. On hosts with an ephemeral disk they disappear on " +
      "every restart; set the CLOUDINARY_* variables or mount a persistent volume.",
  );
}

/** Cloudinary request signature: SHA-1 of the sorted "key=value" pairs joined by & plus the secret. */
export function cloudinarySignature(params: Record<string, string>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(toSign + secret)
    .digest("hex");
}

/**
 * Public delivery URL for a stored file name like "<id>.png". f_auto and q_auto let Cloudinary
 * pick the best format and quality for each browser.
 */
export function cloudImageUrl(fileName: string): string {
  if (!cloud) throw new Error("Cloud storage is not configured");
  const id = fileName.replace(/\.[a-z]+$/, "");
  return `https://res.cloudinary.com/${cloud.name}/image/upload/f_auto,q_auto/${FOLDER}/${id}`;
}

async function saveStored(name: string, buffer: Buffer): Promise<void> {
  if (!cloud) {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, name), buffer, { flag: "wx" });
    return;
  }

  const publicId = `${FOLDER}/${name.replace(/\.[a-z]+$/, "")}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(buffer)]), name);
  form.set("api_key", cloud.key);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set(
    "signature",
    cloudinarySignature({ public_id: publicId, timestamp }, cloud.secret),
  );

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud.name}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    logger.error({ status: res.status, body: await res.text() }, "Cloudinary upload failed");
    throw new AppError(502, "Image storage is unavailable, try again later");
  }
}

async function removeStored(name: string): Promise<void> {
  if (!cloud) {
    await fs.rm(path.join(uploadDir, name), { force: true });
    return;
  }

  const publicId = `${FOLDER}/${name.replace(/\.[a-z]+$/, "")}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp,
    api_key: cloud.key,
    signature: cloudinarySignature({ public_id: publicId, timestamp }, cloud.secret),
  });
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud.name}/image/destroy`, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(`Cloudinary delete failed (${res.status})`);
}

/**
 * Direct uploads: the browser sends the file straight to Cloudinary, so large photos never
 * pass through (and cannot be rejected by) the serverless function. The API only hands out a
 * short-lived signed ticket for one random file name, then confirms the result.
 * Without Cloudinary the client falls back to the normal multipart upload.
 */
export function createUploadTicket(): UploadTicket {
  if (!cloud) return { mode: "server" };
  const id = crypto.randomBytes(16).toString("hex");
  const publicId = `${FOLDER}/${id}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const allowedFormats = "png,jpg,gif,webp";
  return {
    mode: "direct",
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud.name}/image/upload`,
    apiKey: cloud.key,
    timestamp,
    publicId,
    allowedFormats,
    signature: cloudinarySignature(
      { allowed_formats: allowedFormats, public_id: publicId, timestamp },
      cloud.secret,
    ),
  };
}

/** Checks that the file really exists in storage and returns the reference the app stores. */
export async function confirmDirectUpload(id: string, format: string): Promise<string> {
  if (!cloud) throw badRequest("Direct uploads are not enabled");
  const ext = format === "jpeg" ? "jpg" : format;
  let ok = false;
  try {
    const res = await fetch(`https://res.cloudinary.com/${cloud.name}/image/upload/${FOLDER}/${id}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
    });
    ok = res.ok;
  } catch (err) {
    logger.warn({ err: String(err) }, "Could not verify direct upload");
  }
  if (!ok) throw badRequest("We could not find the uploaded image, please try again");
  return `/uploads/${id}.${ext}`;
}

export async function saveImage(buffer: Buffer, ext: ImageExt): Promise<string> {
  // Random name: never use the client's filename.
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await saveStored(name, buffer);
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
    await removeStored(path.basename(url));
  } catch (err) {
    logger.warn({ err, url }, "Failed to delete upload");
  }
}

import type { Request, Response } from "express";
import type { UploadResponse } from "@commune/shared";
import { confirmDirectUpload, createUploadTicket, saveImage } from "../services/uploadService.js";
import { badRequest } from "../utils/errors.js";
import { detectImageType } from "../utils/images.js";

export async function upload(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw badRequest("No file uploaded");

  const ext = detectImageType(file.buffer);
  if (!ext) throw badRequest("Only PNG, JPEG, GIF and WebP images are allowed");

  const body: UploadResponse = { url: await saveImage(file.buffer, ext) };
  res.status(201).json(body);
}

/** POST /uploads/sign: how should this browser upload? (direct to storage, or through the API) */
export async function sign(_req: Request, res: Response) {
  res.set("Cache-Control", "no-store");
  res.json(createUploadTicket());
}

/** POST /uploads/complete: confirm a direct upload and get the reference to store on the post. */
export async function complete(req: Request, res: Response) {
  const { id, format } = req.body as { id: string; format: string };
  const body: UploadResponse = { url: await confirmDirectUpload(id, format) };
  res.status(201).json(body);
}

import type { Request, Response } from "express";
import type { UploadResponse } from "@commune/shared";
import { saveImage } from "../services/uploadService.js";
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

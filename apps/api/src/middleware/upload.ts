import type { RequestHandler } from "express";
import multer from "multer";
import { MAX_IMAGE_BYTES } from "@commune/shared";
import { badRequest } from "../utils/errors.js";

// Files are held in memory (max 4 MB) so their real type can be checked before anything
// is written to disk.
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single("file");

/** Parses one multipart "file" field into req.file and turns multer errors into 400s. */
export const parseImageUpload: RequestHandler = (req, res, next) => {
  parser(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE" ? "Image must be 4 MB or smaller" : "Invalid upload";
      return next(badRequest(message));
    }
    next(err);
  });
};

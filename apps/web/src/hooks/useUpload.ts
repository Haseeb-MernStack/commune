import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { UploadResponse } from "@commune/shared";
import { AVATAR_PHOTO, POST_PHOTO, prepareImage } from "../lib/images";
import { uploadImage } from "../lib/upload";

/**
 * Shrinks and uploads one image; resolves with its stored path ({ url }).
 * `progress` is 0 to 100 while a file is being sent, otherwise null.
 */
export function useUploadImage(kind: "post" | "avatar" = "post") {
  const [progress, setProgress] = useState<number | null>(null);
  const mutation = useMutation<UploadResponse, Error, File>({
    mutationFn: async (file) => {
      setProgress(0);
      try {
        const ready = await prepareImage(file, kind === "avatar" ? AVATAR_PHOTO : POST_PHOTO);
        return await uploadImage(ready, setProgress);
      } finally {
        setProgress(null);
      }
    },
  });
  return { ...mutation, progress };
}

import { useMutation } from "@tanstack/react-query";
import type { UploadResponse } from "@commune/shared";
import { api } from "../lib/api";

/** Uploads one image and resolves with its stored path ({ url }). */
export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api<UploadResponse>("/uploads", { method: "POST", body: form });
    },
  });
}

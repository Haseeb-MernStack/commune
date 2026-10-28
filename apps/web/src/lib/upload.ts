import type { UploadResponse, UploadTicket } from "@commune/shared";
import { ApiError, api } from "./api";

/** Sends the file straight to cloud storage with progress. Resolves with the stored file's id and format. */
function sendToCloud(
  ticket: Extract<UploadTicket, { mode: "direct" }>,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ id: string; format: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("api_key", ticket.apiKey);
    form.set("timestamp", ticket.timestamp);
    form.set("public_id", ticket.publicId);
    form.set("allowed_formats", ticket.allowedFormats);
    form.set("signature", ticket.signature);
    form.set("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", ticket.uploadUrl);
    xhr.timeout = 90_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Storage answered ${xhr.status}`));
      try {
        const body = JSON.parse(xhr.responseText) as { public_id?: string; format?: string };
        const id = body.public_id?.split("/").pop();
        if (!id || !body.format) throw new Error("Unexpected storage response");
        resolve({ id, format: body.format });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Unexpected storage response"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(form);
  });
}

/**
 * Uploads one (already shrunk) image and resolves with the reference to store on a post or
 * profile. It goes directly to cloud storage when the server offers that, which avoids the
 * serverless request-size limit; if that fails for any reason it falls back to uploading
 * through the API.
 */
export async function uploadImage(file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> {
  let ticket: UploadTicket = { mode: "server" };
  try {
    ticket = await api<UploadTicket>("/uploads/sign", { method: "POST" });
  } catch (err) {
    // Not logged in, suspended or rate limited: the fallback would fail the same way.
    if (err instanceof ApiError && [401, 403, 429].includes(err.status)) throw err;
  }

  if (ticket.mode === "direct") {
    try {
      const stored = await sendToCloud(ticket, file, onProgress);
      return await api<UploadResponse>("/uploads/complete", { method: "POST", body: stored });
    } catch {
      /* use the normal upload below */
    }
  }

  onProgress?.(0);
  const form = new FormData();
  form.append("file", file);
  return api<UploadResponse>("/uploads", { method: "POST", body: form });
}

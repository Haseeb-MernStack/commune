import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AvatarAllowance } from "@commune/shared";
import { api } from "../lib/api";
import { validateImage } from "../lib/images";
import { useUploadImage } from "./useUpload";
import { useUpdateProfile } from "./useSocial";

export function useAvatarAllowance(enabled: boolean) {
  return useQuery({
    queryKey: ["avatar-allowance"],
    queryFn: () => api<AvatarAllowance>("/users/me/avatar-allowance"),
    enabled,
    staleTime: 30_000,
  });
}

/** "about 5 hours" until the next photo change is possible. */
export function waitText(resetsAt: string | null | undefined): string {
  if (!resetsAt) return "a little while";
  const hours = Math.max(1, Math.ceil((new Date(resetsAt).getTime() - Date.now()) / 3_600_000));
  return `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/**
 * Changing the profile photo: the chosen picture shows at once while it uploads, and the daily
 * limit is checked before anything is sent, so a refused change never wastes an upload.
 */
export function useProfilePhoto(allowance: AvatarAllowance | undefined) {
  const qc = useQueryClient();
  const upload = useUploadImage("avatar");
  const update = useUpdateProfile();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const dropPreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
  };
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const refreshAllowance = () => void qc.invalidateQueries({ queryKey: ["avatar-allowance"] });
  const fail = (message: string) => {
    setError(message);
    dropPreview();
    refreshAllowance();
  };

  const noneLeft = allowance !== undefined && allowance.remaining === 0;

  const choose = (file: File) => {
    setError(null);
    // The yellow warning under the profile already says so; nothing is uploaded.
    if (noneLeft) return;
    const problem = validateImage(file);
    if (problem) {
      setError(problem);
      return;
    }
    dropPreview();
    previewRef.current = URL.createObjectURL(file);
    setPreview(previewRef.current);
    upload.mutate(file, {
      onSuccess: ({ url }) =>
        update.mutate(
          { avatarUrl: url },
          {
            onSuccess: () => {
              dropPreview();
              refreshAllowance();
            },
            onError: (err) => fail(err.message),
          },
        ),
      onError: (err) => fail(err.message),
    });
  };

  const remove = () => {
    setError(null);
    // The yellow warning under the profile already says so; nothing is uploaded.
    if (noneLeft) return;
    update.mutate(
      { avatarUrl: null },
      { onSuccess: refreshAllowance, onError: (e) => fail(e.message) },
    );
  };

  return {
    choose,
    remove,
    preview,
    error,
    clearError: () => setError(null),
    busy: upload.isPending || update.isPending,
    progress: upload.progress,
    noneLeft,
  };
}

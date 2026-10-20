import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useCreatePost } from "../hooks/usePosts";
import { useUploadImage } from "../hooks/useUpload";
import { assetUrl } from "../lib/api";
import { validateImage } from "../lib/images";

const MAX = 500;

export default function Composer() {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreatePost();
  const upload = useUploadImage();

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again later
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setImageError(problem);
      return;
    }
    setImageError(null);
    upload.mutate(file, {
      onSuccess: ({ url }) => setImageUrl(url),
      onError: (err) => setImageError(err.message),
    });
  };

  const canPost = (content.trim().length > 0 || imageUrl !== null) && !upload.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canPost) return;
    create.mutate(
      { content, imageUrl },
      {
        onSuccess: () => {
          setContent("");
          setImageUrl(null);
        },
      },
    );
  };

  return (
    <form className="card composer" onSubmit={submit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's happening in your community?"
        maxLength={MAX}
        rows={3}
      />

      {upload.isPending && <p className="muted">Uploading image…</p>}
      {imageUrl && (
        <div className="image-preview">
          <img src={assetUrl(imageUrl)} alt="Attached preview" />
          <button
            type="button"
            className="image-remove"
            aria-label="Remove image"
            onClick={() => setImageUrl(null)}
          >
            ×
          </button>
        </div>
      )}
      {imageError && <p className="error">{imageError}</p>}

      <div className="composer-footer">
        <span className="row">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            onChange={pickImage}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            aria-label="Attach an image"
          >
            🖼️ Photo
          </button>
          <span className="muted">
            {content.length}/{MAX}
          </span>
        </span>
        <button className="btn" disabled={create.isPending || !canPost}>
          {create.isPending ? "Posting…" : "Post"}
        </button>
      </div>
      {create.isError && <p className="error">{create.error.message}</p>}
    </form>
  );
}

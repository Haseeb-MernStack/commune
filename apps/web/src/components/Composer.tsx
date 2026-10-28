import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent, FormEvent } from "react";
import { useCreatePost } from "../hooks/usePosts";
import { useUploadImage } from "../hooks/useUpload";
import { assetUrl } from "../lib/api";
import { validateImage } from "../lib/images";
import {
  FREE_POST_LENGTH,
  MAX_PREMIUM_LENGTH,
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
  PLUS_POST_LENGTH,
} from "@commune/shared";
import { useAuth } from "../store/auth";
import Avatar from "./Avatar";
import Icon from "./Icon";


export default function Composer({ communitySlug }: { communitySlug?: string }) {
  const { user } = useAuth();
  const MAX = user?.plus ? PLUS_POST_LENGTH : FREE_POST_LENGTH;
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null); // local copy, shown instantly
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const attempt = useRef(0); // ignores the result of an upload the person has already cancelled
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState("5");
  const [premium, setPremium] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreatePost();
  const upload = useUploadImage("post");

  // Free the temporary preview when it is replaced or the composer goes away.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  /** Used by the file picker, paste and drag-and-drop. */
  const handleFile = (file: File) => {
    const problem = validateImage(file);
    if (problem) {
      setImageError(problem);
      return;
    }
    setImageError(null);
    setImageUrl(null);
    setLastFile(file);
    setPreview(URL.createObjectURL(file));
    const mine = ++attempt.current;
    upload.mutate(file, {
      onSuccess: ({ url }) => {
        if (mine !== attempt.current) return;
        setImageUrl(url);
        setLastFile(null);
      },
      onError: (err) => {
        if (mine === attempt.current) setImageError(err.message);
      },
    });
  };

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again later
    if (file) handleFile(file);
  };

  const imageFrom = (files: FileList | null | undefined) =>
    Array.from(files ?? []).find((f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(f.name));

  const onPaste = (e: ClipboardEvent) => {
    const file = imageFrom(e.clipboardData.files);
    if (file) {
      e.preventDefault();
      handleFile(file);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = imageFrom(e.dataTransfer.files);
    if (file) handleFile(file);
  };

  const removeImage = () => {
    attempt.current++;
    setImageUrl(null);
    setPreview(null);
    setLastFile(null);
    setImageError(null);
  };

  const priceCents = Math.round(Number(price) * 100);
  const priceOk = priceCents >= MIN_PRICE_CENTS && priceCents <= MAX_PRICE_CENTS;
  const paidOk = !paid || (priceOk && premium.trim().length > 0);
  const canPost =
    (content.trim().length > 0 || imageUrl !== null) && !upload.isPending && paidOk;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canPost) return;
    create.mutate(
      { content, imageUrl, ...(communitySlug ? { community: communitySlug } : {}), ...(paid ? { priceCents, premiumContent: premium } : {}) },
      {
        onSuccess: () => {
          setContent("");
          setImageUrl(null);
          setPreview(null);
          setPaid(false);
          setPremium("");
        },
      },
    );
  };

  return (
    <form
      className={`card composer${dragging ? " dragging" : ""}`}
      onSubmit={submit}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="composer-row">
        {user && <Avatar username={user.username} url={user.avatarUrl} size={42} />}
        <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={communitySlug ? `Post in c/${communitySlug}` : "What's happening in your community?"}
        maxLength={MAX}
        rows={2}
        aria-label="Write a post"
        onPaste={onPaste}
      />
      </div>

      {paid && (
        <div className="paid-fields">
          <label>
            Price (USD, {MIN_PRICE_CENTS / 100} to {MAX_PRICE_CENTS / 100})
            <input
              type="number"
              min={MIN_PRICE_CENTS / 100}
              max={MAX_PRICE_CENTS / 100}
              step="0.5"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <textarea
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
            placeholder="The content people pay to unlock. The text above stays free as a teaser."
            maxLength={MAX_PREMIUM_LENGTH}
            rows={4}
          />
          {!priceOk && <p className="error">Enter a price within the range.</p>}
        </div>
      )}

      {(preview || imageUrl) && (
        <div className="image-preview">
          <img src={preview ?? assetUrl(imageUrl)} alt="Attached preview" />
          {upload.isPending && (
            <div
              className="upload-progress"
              role="progressbar"
              aria-label="Uploading image"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={upload.progress ?? 0}
            >
              <span style={{ width: `${Math.max(6, upload.progress ?? 0)}%` }} />
            </div>
          )}
          <button type="button" className="image-remove" aria-label="Remove image" onClick={removeImage}>
            ×
          </button>
        </div>
      )}
      {upload.isPending && (
        <p className="muted small" role="status">
          {upload.progress ? `Uploading… ${upload.progress}%` : "Preparing photo…"}
        </p>
      )}
      {imageError && (
        <p className="error" role="alert">
          {imageError}{" "}
          {lastFile && !upload.isPending && (
            <button type="button" className="link-btn" onClick={() => handleFile(lastFile)}>
              Try again
            </button>
          )}
        </p>
      )}

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
            <Icon name="image" size={20} /> Photo
          </button>
          <label className="row paid-toggle">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Paid
          </label>
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

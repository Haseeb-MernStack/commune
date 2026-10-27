import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
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


export default function Composer({ communitySlug }: { communitySlug?: string }) {
  const { user } = useAuth();
  const MAX = user?.plus ? PLUS_POST_LENGTH : FREE_POST_LENGTH;
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState("5");
  const [premium, setPremium] = useState("");
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
          setPaid(false);
          setPremium("");
        },
      },
    );
  };

  return (
    <form className="card composer" onSubmit={submit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={communitySlug ? `Post in c/${communitySlug}` : "What's happening in your community?"}
        maxLength={MAX}
        rows={3}
      />

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

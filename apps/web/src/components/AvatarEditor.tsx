import { useRef } from "react";
import type { ChangeEvent } from "react";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { useAvatarAllowance, useProfilePhoto, waitText } from "../hooks/useProfilePhoto";

/**
 * Your own profile photo: tap it to choose a new one. The new picture shows straight away while
 * it uploads, and a small note says how many of today's changes are left.
 */
export default function AvatarEditor({
  username,
  url,
  size = 72,
}: {
  username: string;
  url: string | null;
  size?: number;
}) {
  const allowance = useAvatarAllowance(true);
  const photo = useProfilePhoto(allowance.data);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) photo.choose(file);
  };

  const a = allowance.data;
  const label = photo.noneLeft
    ? `No photo changes left today. Try again in ${waitText(a?.resetsAt)}.`
    : "Change profile photo";

  return (
    <div className="avatar-edit">
      <div className="avatar-edit-frame" style={{ width: size, height: size }}>
        {photo.preview ? (
          <img
            className="avatar"
            src={photo.preview}
            alt=""
            style={{ width: size, height: size }}
          />
        ) : (
          <Avatar username={username} url={url} size={size} />
        )}
        {photo.busy && (
          <span className="avatar-edit-busy" role="status" aria-label="Uploading photo">
            {photo.progress ? `${photo.progress}%` : "…"}
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={onPick}
        />
        <button
          type="button"
          className="avatar-edit-btn"
          aria-label={label}
          title={label}
          disabled={photo.busy}
          aria-disabled={photo.noneLeft || undefined}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="camera" size={16} />
        </button>
      </div>
      <div className="avatar-edit-note" aria-live="polite">
        {photo.error ? (
          <span className="error small">{photo.error}</span>
        ) : a ? (
          <span className="muted small">
            {a.remaining} of {a.limit} photo changes left today
          </span>
        ) : null}
        {url && !photo.busy && (
          <button type="button" className="link-btn small" onClick={photo.remove}>
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}

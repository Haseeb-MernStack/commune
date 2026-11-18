import { useRef } from "react";
import type { ChangeEvent } from "react";
import type { AvatarAllowance } from "@commune/shared";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { waitText } from "../hooks/useProfilePhoto";
import type { useProfilePhoto } from "../hooks/useProfilePhoto";

type Photo = ReturnType<typeof useProfilePhoto>;

/**
 * Your own profile photo: tap it to choose a new one. The new picture shows straight away while
 * it uploads. The note about today's changes is a separate piece, see PhotoNotice.
 */
export default function AvatarEditor({
  username,
  url,
  size,
  photo,
}: {
  username: string;
  url: string | null;
  size: number;
  photo: Photo;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) photo.choose(file);
  };

  const label = photo.noneLeft ? "No photo changes left today" : "Change profile photo";

  return (
    <div className="avatar-edit-frame" style={{ width: size, height: size }}>
      {photo.preview ? (
        <img className="avatar" src={photo.preview} alt="" width={size} height={size} />
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
  );
}

/**
 * Under your profile: how many photo changes are left, or, once all of them are used, one yellow
 * warning saying when the next change opens (and nothing else).
 */
export function PhotoNotice({
  allowance,
  photo,
  hasPhoto,
}: {
  allowance: AvatarAllowance | undefined;
  photo: Photo;
  hasPhoto: boolean;
}) {
  const limitReached = allowance !== undefined && allowance.remaining === 0;
  return (
    <div className="photo-notice" aria-live="polite">
      {limitReached ? (
        <p className="photo-warning" role="status">
          <Icon name="flag" size={16} />
          <span>
            You've used all {allowance.limit} photo changes for today. You can change it again in{" "}
            {waitText(allowance.resetsAt)}.
          </span>
        </p>
      ) : (
        <>
          {photo.error && <p className="error small">{photo.error}</p>}
          {!photo.error && allowance && (
            <span className="muted small">
              {allowance.remaining} of {allowance.limit} photo changes left today
            </span>
          )}
          {hasPhoto && !photo.busy && (
            <button type="button" className="link-btn small" onClick={photo.remove}>
              Remove photo
            </button>
          )}
        </>
      )}
      {limitReached && photo.error && <p className="error small">{photo.error}</p>}
    </div>
  );
}

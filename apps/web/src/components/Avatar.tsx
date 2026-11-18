import { assetUrl } from "../lib/api";
import { hueFor } from "../lib/hue";

/** Profile photo, or a colored circle with the user's initial when there is none. */
/** Smallest stored size that is still sharp on a 2x screen (the API offers these four). */
function variant(size: number): number {
  const need = size * 2;
  return [64, 128, 256, 512].find((s) => s >= need) ?? 512;
}

export default function Avatar({
  username,
  url,
  size = 40,
}: {
  username: string;
  url?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (url) {
    // Stored photos are asked for at the size they are shown, so lists and comments stay light.
    const src = url.startsWith("/uploads/") ? `${assetUrl(url)}?s=${variant(size)}` : assetUrl(url);
    return (
      <img
        className="avatar"
        src={src}
        alt=""
        width={size}
        height={size}
        style={style}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const hue = hueFor(username);
  return (
    <span
      className="avatar avatar-fallback"
      style={{
        ...style,
        background: `linear-gradient(145deg, ${hue.bg}, color-mix(in srgb, ${hue.bg} 62%, #14183a))`,
        color: hue.fg,
      }}
      role="img"
      aria-label={`${username}, no profile photo`}
    >
      <span className="avatar-initial" aria-hidden="true">
        {username.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

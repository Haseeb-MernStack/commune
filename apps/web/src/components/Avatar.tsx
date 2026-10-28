import { assetUrl } from "../lib/api";
import { hueFor } from "../lib/hue";

/** Profile photo, or a colored circle with the user's initial when there is none. */
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
    return <img className="avatar" src={assetUrl(url)} alt="" style={style} loading="lazy" />;
  }
  const hue = hueFor(username);
  return (
    <span
      className="avatar avatar-fallback"
      style={{ ...style, background: hue.bg, color: hue.fg }}
      aria-hidden="true"
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

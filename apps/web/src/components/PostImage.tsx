import { useState } from "react";
import type { PostDTO } from "@commune/shared";
import { assetUrl } from "../lib/api";

/**
 * A post's image in a box of the right size before it loads, so the feed does not jump.
 * With a known size the box has the image's own shape; an older post without one gets a 4:3
 * box and the image is cropped to fill it. A soft colour shows until the image fades in.
 */
export default function PostImage({
  post,
}: {
  post: Pick<PostDTO, "imageUrl" | "imageWidth" | "imageHeight" | "author">;
}) {
  const [loaded, setLoaded] = useState(false);
  if (!post.imageUrl) return null;
  const width = post.imageWidth ?? undefined;
  const height = post.imageHeight ?? undefined;
  const sized = Boolean(width && height);
  const className = [
    "post-image",
    sized ? "" : "post-image-unsized",
    loaded ? "is-loaded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      className={className}
      src={assetUrl(post.imageUrl)}
      alt={`Image posted by @${post.author.username}`}
      width={width}
      height={height}
      style={sized ? { aspectRatio: `${width} / ${height}` } : undefined}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
    />
  );
}

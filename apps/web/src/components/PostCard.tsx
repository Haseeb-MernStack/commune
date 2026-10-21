import { useState } from "react";
import { Link } from "react-router-dom";
import type { PostDTO } from "@commune/shared";
import { useAuth } from "../store/auth";
import { useDeletePost, useToggleLike } from "../hooks/usePosts";
import { assetUrl } from "../lib/api";
import Avatar from "./Avatar";
import ReportForm from "./ReportForm";

export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function PostCard({ post }: { post: PostDTO }) {
  const { user } = useAuth();
  const like = useToggleLike();
  const del = useDeletePost();
  const [reporting, setReporting] = useState(false);
  const mine = user?.id === post.author.id;
  const isAdmin = user?.role === "admin";

  return (
    <article className="card post post-head">
      <Avatar username={post.author.username} url={post.author.avatarUrl} />
      <div className="post-main">
        <div className="post-meta">
          <Link to={`/u/${post.author.username}`} className="user-link">
            @{post.author.username}
          </Link>
          <span className="muted">· {timeAgo(post.createdAt)}</span>
        </div>
        {post.content && <p className="post-body">{post.content}</p>}
        {post.imageUrl && (
          <a href={assetUrl(post.imageUrl)} target="_blank" rel="noopener noreferrer">
            <img
              className="post-image"
              src={assetUrl(post.imageUrl)}
              alt={`Image posted by @${post.author.username}`}
              loading="lazy"
            />
          </a>
        )}
        <div className="post-actions">
          <button
            className={`btn btn-ghost ${post.likedByMe ? "liked" : ""}`}
            onClick={() => like.mutate(post.id)}
            disabled={like.isPending}
            aria-pressed={post.likedByMe}
          >
            {post.likedByMe ? "♥" : "♡"} {post.likeCount}
          </button>
          <Link className="btn btn-ghost" to={`/posts/${post.id}`}>
            💬 {post.commentCount}
          </Link>
          {!mine && (
            <button
              className="btn btn-ghost"
              onClick={() => setReporting((r) => !r)}
              aria-expanded={reporting}
            >
              ⚑ Report
            </button>
          )}
          {(mine || isAdmin) && (
            <button
              className="btn btn-ghost danger"
              onClick={() =>
                window.confirm(mine ? "Delete this post?" : "Remove this post as an admin?") &&
                del.mutate(post.id)
              }
            >
              {mine ? "Delete" : "Remove"}
            </button>
          )}
        </div>
        {reporting && <ReportForm postId={post.id} onClose={() => setReporting(false)} />}
      </div>
    </article>
  );
}

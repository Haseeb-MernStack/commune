import { Link } from "react-router-dom";
import type { PostDTO } from "@commune/shared";
import { useAuth } from "../store/auth";
import { useDeletePost, useToggleLike } from "../hooks/usePosts";

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
  const mine = user?.id === post.author.id;

  return (
    <article className="card post">
      <div className="post-meta">
        <Link to={`/u/${post.author.username}`} className="user-link">
          @{post.author.username}
        </Link>
        <span className="muted">· {timeAgo(post.createdAt)}</span>
      </div>
      <p className="post-body">{post.content}</p>
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
        {mine && (
          <button
            className="btn btn-ghost danger"
            onClick={() => window.confirm("Delete this post?") && del.mutate(post.id)}
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

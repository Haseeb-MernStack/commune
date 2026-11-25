import RichText from "../components/RichText";
import { useState } from "react";
import { PostListSkeleton } from "../components/Skeleton";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import PostCard from "../components/PostCard";
import { timeAgo } from "../lib/time";
import PlusBadge from "../components/PlusBadge";
import { useTrackView } from "../hooks/useBilling";
import { isPendingComment, useAddComment, useComments, usePost } from "../hooks/usePosts";
import { useAuth } from "../store/auth";

export default function PostPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  // Coming back from checkout: the unlock arrives by webhook, so keep checking for a moment.
  const justPaid = params.get("unlocked") === "1";
  const post = usePost(id, justPaid);
  useTrackView(id);
  const comments = useComments(id);
  const { user } = useAuth();
  const add = useAddComment(
    id,
    user
      ? { id: user.id, username: user.username, avatarUrl: user.avatarUrl, plus: user.plus }
      : null,
  );
  const [content, setContent] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const sent = content;
    // The comment shows in the list at once, so the box is cleared straight away.
    setContent("");
    add.mutate(sent, {
      // Give the text back unless something new was typed meanwhile.
      onError: () => setContent((now) => (now ? now : sent)),
    });
  };

  return (
    <>
      <Link to="/" className="muted">
        ← Back to feed
      </Link>
      {post.isLoading && <PostListSkeleton count={1} />}
      {post.isError && <p className="error center">Post not found.</p>}
      {justPaid && post.data?.locked && (
        <p className="notice">Payment received. Unlocking your post, this takes a few seconds…</p>
      )}
      {post.data && <PostCard post={post.data} fullText />}

      <form className="card composer" onSubmit={submit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment"
          maxLength={300}
          rows={2}
        />
        <div className="composer-footer">
          <span className="muted">{content.length}/300</span>
          <button className="btn" disabled={add.isPending || !content.trim()}>
            Comment
          </button>
        </div>
        {add.isError && <p className="error">{add.error.message}</p>}
      </form>

      {comments.data?.map((c) => (
        <div
          key={c.id}
          className={`card comment post-head${isPendingComment(c) ? " comment-pending" : ""}`}
          aria-busy={isPendingComment(c) || undefined}
        >
          <Avatar username={c.author.username} url={c.author.avatarUrl} size={32} />
          <div className="post-main">
            <div className="post-meta">
              <Link to={`/u/${c.author.username}`} className="user-link">
                @{c.author.username}
              </Link>
              <PlusBadge plus={c.author.plus} />
              <span className="muted">
                · {isPendingComment(c) ? "Sending…" : timeAgo(c.createdAt)}
              </span>
            </div>
            <p className="post-body">
              <RichText text={c.content} />
            </p>
          </div>
        </div>
      ))}
    </>
  );
}

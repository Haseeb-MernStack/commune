import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import PostCard, { timeAgo } from "../components/PostCard";
import { useAddComment, useComments, usePost } from "../hooks/usePosts";

export default function PostPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  // Coming back from checkout: the unlock arrives by webhook, so keep checking for a moment.
  const justPaid = params.get("unlocked") === "1";
  const post = usePost(id, justPaid);
  const comments = useComments(id);
  const add = useAddComment(id);
  const [content, setContent] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    add.mutate(content, { onSuccess: () => setContent("") });
  };

  return (
    <>
      <Link to="/" className="muted">
        ← Back to feed
      </Link>
      {post.isLoading && <p className="muted center">Loading…</p>}
      {post.isError && <p className="error center">Post not found.</p>}
      {justPaid && post.data?.locked && (
        <p className="notice">Payment received. Unlocking your post, this takes a few seconds…</p>
      )}
      {post.data && <PostCard post={post.data} />}

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
        <div key={c.id} className="card comment post-head">
          <Avatar username={c.author.username} url={c.author.avatarUrl} size={32} />
          <div className="post-main">
            <div className="post-meta">
              <Link to={`/u/${c.author.username}`} className="user-link">
                @{c.author.username}
              </Link>
              <span className="muted">· {timeAgo(c.createdAt)}</span>
            </div>
            <p className="post-body">{c.content}</p>
          </div>
        </div>
      ))}
    </>
  );
}

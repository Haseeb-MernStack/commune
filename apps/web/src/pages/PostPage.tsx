import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import PostCard, { timeAgo } from "../components/PostCard";
import { useAddComment, useComments, usePost } from "../hooks/usePosts";

export default function PostPage() {
  const { id = "" } = useParams();
  const post = usePost(id);
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
        <div key={c.id} className="card comment">
          <div className="post-meta">
            <Link to={`/u/${c.author.username}`} className="user-link">
              @{c.author.username}
            </Link>
            <span className="muted">· {timeAgo(c.createdAt)}</span>
          </div>
          <p className="post-body">{c.content}</p>
        </div>
      ))}
    </>
  );
}

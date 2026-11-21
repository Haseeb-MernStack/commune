import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { FREE_POST_LENGTH, PLUS_POST_LENGTH, type PostDTO } from "@commune/shared";
import { useAuth } from "../store/auth";
import RichText from "./RichText";
import { useDeletePost, useToggleLike, useUpdatePost } from "../hooks/usePosts";
import { formatPrice, useCheckout } from "../hooks/usePayments";
import { assetUrl } from "../lib/api";
import Avatar from "./Avatar";
import Icon from "./Icon";
import PlusBadge from "./PlusBadge";
import { hueFor } from "../lib/hue";
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
  const checkout = useCheckout();
  const update = useUpdatePost();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [reporting, setReporting] = useState(false);
  const mine = user?.id === post.author.id;
  const isAdmin = user?.role === "admin";
  const max = user?.plus ? PLUS_POST_LENGTH : Math.max(FREE_POST_LENGTH, post.content.length);

  const startEdit = () => {
    setDraft(post.content);
    update.reset();
    setEditing(true);
  };
  const save = () => {
    const next = draft.trim();
    if (update.isPending) return;
    if (next === post.content) return setEditing(false);
    update.mutate({ id: post.id, content: next }, { onSuccess: () => setEditing(false) });
  };

  return (
    <article className="card post post-head">
      <Avatar username={post.author.username} url={post.author.avatarUrl} />
      <div className="post-main">
        <div className="post-meta">
          <Link to={`/u/${post.author.username}`} className="user-link">
            @{post.author.username}
          </Link>
          <PlusBadge plus={post.author.plus} />
          <Link
            to={`/posts/${post.id}`}
            className="post-time muted"
            title={new Date(post.createdAt).toLocaleString()}
          >
            <span aria-hidden="true">· </span>
            <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
          </Link>
          {post.editedAt && (
            <span
              className="post-edited muted"
              title={`Edited ${new Date(post.editedAt).toLocaleString()}`}
            >
              · edited
            </span>
          )}
          {post.community && (
            <Link
              to={`/c/${post.community.slug}`}
              className="community-tag"
              style={{ "--hue": hueFor(post.community.slug).bg } as CSSProperties}
            >
              c/{post.community.slug}
            </Link>
          )}
          {post.priceCents != null && (
            <span className="price-badge">{formatPrice(post.priceCents)}</span>
          )}
        </div>
        {editing ? (
          <div className="post-edit">
            <textarea
              className="input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
              }}
              maxLength={max}
              rows={Math.min(10, Math.max(3, draft.split("\n").length + 1))}
              aria-label="Edit your post"
              autoFocus
            />
            <div className="post-edit-bar">
              <span
                className={`muted small${draft.length >= max ? " at-limit" : ""}`}
                aria-live="polite"
              >
                {draft.length}/{max}
              </span>
              <span className="row">
                <button className="btn btn-outline" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button
                  className="btn"
                  onClick={save}
                  disabled={update.isPending || (!draft.trim() && !post.imageUrl)}
                >
                  {update.isPending ? "Saving…" : "Save"}
                </button>
              </span>
            </div>
            {update.isError && (
              <p className="error" role="alert">
                {update.error.message}
              </p>
            )}
          </div>
        ) : (
          post.content && (
            <p className="post-body">
              <RichText text={post.content} />
            </p>
          )
        )}
        {post.imageUrl && (
          <a href={assetUrl(post.imageUrl)} target="_blank" rel="noopener noreferrer">
            <img
              className="post-image"
              src={assetUrl(post.imageUrl)}
              alt={`Image posted by @${post.author.username}`}
              loading="lazy"
              decoding="async"
            />
          </a>
        )}
        {post.locked && post.priceCents != null && (
          <div className="paywall">
            <p>
              <Icon name="lock" size={16} /> The rest of this post is for people who unlock it.
            </p>
            <button
              className="btn"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate(post.id)}
            >
              {checkout.isPending
                ? "Opening checkout…"
                : `Unlock for ${formatPrice(post.priceCents)}`}
            </button>
            {checkout.isError && (
              <p className="error" role="alert">
                {checkout.error.message}
              </p>
            )}
          </div>
        )}
        {post.premiumContent && (
          <div className="premium">
            <span className="premium-label">Unlocked content</span>
            <p className="post-body">{post.premiumContent}</p>
          </div>
        )}
        <div className="post-actions">
          <button
            className={`btn btn-ghost ${post.likedByMe ? "liked" : ""}`}
            onClick={() => {
              if (!like.isPending) like.mutate(post.id);
            }}
            aria-pressed={post.likedByMe}
            aria-label={`${post.likedByMe ? "Unlike" : "Like"}, ${post.likeCount} ${
              post.likeCount === 1 ? "like" : "likes"
            }`}
          >
            <Icon name="heart" size={19} filled={post.likedByMe} />
            <span>{post.likeCount}</span>
          </button>
          <Link
            className="btn btn-ghost"
            to={`/posts/${post.id}`}
            aria-label={`${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}, open post`}
          >
            <Icon name="comment" size={19} />
            <span>{post.commentCount}</span>
          </Link>
          {!mine && (
            <button
              className="btn btn-ghost"
              onClick={() => setReporting((r) => !r)}
              aria-expanded={reporting}
            >
              <Icon name="flag" size={18} /> Report
            </button>
          )}
          {mine && !editing && (
            <button className="btn btn-ghost" onClick={startEdit}>
              <Icon name="pencil" size={18} /> Edit
            </button>
          )}
          {(mine || isAdmin) && (
            <button
              className="btn btn-ghost danger"
              disabled={del.isPending}
              onClick={() =>
                window.confirm(mine ? "Delete this post?" : "Remove this post as an admin?") &&
                del.mutate(post.id)
              }
            >
              <Icon name="trash" size={18} /> {mine ? "Delete" : "Remove"}
            </button>
          )}
        </div>
        {(like.isError || del.isError) && (
          <p className="error" role="alert">
            {del.isError
              ? "Could not delete this post. Try again."
              : "Could not update your like. Try again."}
          </p>
        )}
        {reporting && <ReportForm postId={post.id} onClose={() => setReporting(false)} />}
      </div>
    </article>
  );
}

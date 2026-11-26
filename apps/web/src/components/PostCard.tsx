import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { FREE_POST_LENGTH, PLUS_POST_LENGTH, type PostDTO } from "@commune/shared";
import { useAuth } from "../store/auth";
import RichText from "./RichText";
import {
  useDeletePost,
  useToggleLike,
  useUndoableDeletePost,
  useUpdatePost,
} from "../hooks/usePosts";
import { useHiddenPosts } from "../lib/pendingDeletes";
import { useToggleBookmark } from "../hooks/useBookmarks";
import { useDoubleTap } from "../hooks/useDoubleTap";
import { formatPrice, useCheckout } from "../hooks/usePayments";
import { useSetBlock } from "../hooks/useBlocks";
import { assetUrl } from "../lib/api";
import { showToast } from "../lib/toast";
import Avatar from "./Avatar";
import Icon from "./Icon";
import PlusBadge from "./PlusBadge";
import { hueFor } from "../lib/hue";
import { timeAgo } from "../lib/time";
import { tap } from "../lib/haptics";
import PostMenu, { type MenuItem } from "./PostMenu";
import ReportForm from "./ReportForm";

export default function PostCard({
  post,
  fullText = false,
}: {
  post: PostDTO;
  fullText?: boolean;
}) {
  const { user } = useAuth();
  const like = useToggleLike();
  const del = useDeletePost();
  const deleteWithUndo = useUndoableDeletePost();
  const hidden = useHiddenPosts();
  const checkout = useCheckout();
  const update = useUpdatePost();
  const setBlock = useSetBlock();
  const bookmark = useToggleBookmark();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [reporting, setReporting] = useState(false);
  // Plays the small "pop" only right after a tap, never when a post first appears.
  const [popped, setPopped] = useState<"like" | "save" | null>(null);
  const [heart, setHeart] = useState(false);
  const [heartKey, setHeartKey] = useState(0);
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    setExpanded(false);
  }, [post.content]);
  useEffect(() => {
    if (fullText || expanded || editing) return;
    const el = bodyRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [fullText, expanded, post.content, editing]);

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

  const copyLink = async () => {
    const to = `/posts/${post.id}`;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard is not available");
      }
      await navigator.clipboard.writeText(`${window.location.origin}${to}`);
      showToast({ title: "Link copied", body: "Share this post with anyone.", to });
    } catch {
      showToast({
        title: "Could not copy the link",
        body: "Copy this page's address from the address bar instead.",
        to,
      });
    }
  };

  const share = async () => {
    // Paid posts never put their text in a share sheet.
    const text = post.priceCents == null ? post.content.slice(0, 120) : undefined;
    const url = `${window.location.origin}/posts/${post.id}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `@${post.author.username} on Commune`, text, url });
        return;
      } catch (err) {
        // Closing the share sheet is not an error; any other failure falls back to copying.
        if ((err as DOMException).name === "AbortError") return;
      }
    }
    await copyLink();
  };

  // Tapping twice quickly likes the post (and never un-likes it). Works with a mouse and on touch.
  const showHeart = () => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHeartKey((value) => value + 1);
      setHeart(true);
    }
    if (!post.likedByMe && !like.isPending) like.mutate(post.id);
  };
  const onTextTap = useDoubleTap(showHeart);
  // A plain click on the image still opens it in a new tab, but only after the short wait that
  // tells one tap from two. Clicks with Ctrl, Cmd or Shift are left to the browser.
  const onImageTap = useDoubleTap(showHeart, () => {
    if (post.imageUrl) window.open(assetUrl(post.imageUrl), "_blank", "noopener,noreferrer");
  });
  const menuItems: MenuItem[] = [
    { key: "copy", label: "Copy link", icon: "link", onSelect: () => void copyLink() },
  ];
  if (mine && !editing) {
    menuItems.push({ key: "edit", label: "Edit post", icon: "pencil", onSelect: startEdit });
  }
  if (!mine) {
    menuItems.push(
      { key: "report", label: "Report post", icon: "flag", onSelect: () => setReporting(true) },
      {
        key: "mute",
        label: `Mute @${post.author.username}`,
        icon: "mute",
        disabled: setBlock.isPending,
        onSelect: () => setBlock.mutate({ username: post.author.username, kind: "mute" }),
      },
      {
        key: "block",
        label: `Block @${post.author.username}`,
        icon: "block",
        danger: true,
        disabled: setBlock.isPending,
        onSelect: () =>
          window.confirm(`Block @${post.author.username}?`) &&
          setBlock.mutate({ username: post.author.username, kind: "block" }),
      },
    );
  }
  if (mine || isAdmin) {
    menuItems.push({
      key: "delete",
      label: mine ? "Delete post" : "Remove post",
      icon: "trash",
      danger: true,
      disabled: del.isPending,
      // Your own post: deleted after a short Undo window. An admin removal keeps its confirm.
      onSelect: () =>
        mine
          ? deleteWithUndo(post.id)
          : window.confirm("Remove this post as an admin?") && del.mutate(post.id),
    });
  }

  // Hidden while its delete is pending, so Undo shows it again in the same place.
  if (hidden.has(post.id)) return null;

  return (
    <article className="card post ig-post">
      <header className="ig-head">
        <Link
          to={`/u/${post.author.username}`}
          className="ig-avatar"
          tabIndex={-1}
          aria-hidden="true"
        >
          <Avatar username={post.author.username} url={post.author.avatarUrl} size={40} />
        </Link>
        <div className="ig-who">
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
          </div>
          {(post.community || post.priceCents != null) && (
            <div className="ig-sub">
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
          )}
        </div>
        <PostMenu
          items={menuItems}
          label={`More options for the post by @${post.author.username}`}
        />
      </header>
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
          <p
            ref={bodyRef}
            className={!fullText && !expanded ? "post-body clamped" : "post-body"}
            onClick={onTextTap}
          >
            <RichText text={post.content} />
          </p>
        )
      )}
      {!editing && post.content && !fullText && overflows && (
        <button
          type="button"
          className="link-btn"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
      {post.imageUrl && (
        <a
          href={assetUrl(post.imageUrl)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onImageTap}
        >
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
      <div className="ig-bar">
        <div className="ig-bar-left">
          <button
            type="button"
            className={`ig-icon-btn${post.likedByMe ? " liked" : ""}${popped === "like" ? " pop" : ""}`}
            onClick={() => {
              if (like.isPending) return;
              if (!post.likedByMe) {
                setPopped("like");
                tap();
              }
              like.mutate(post.id);
            }}
            onAnimationEnd={() => setPopped(null)}
            aria-pressed={post.likedByMe}
            aria-label={`${post.likedByMe ? "Unlike" : "Like"}, ${post.likeCount} ${
              post.likeCount === 1 ? "like" : "likes"
            }`}
          >
            <Icon name="heart" size={25} filled={post.likedByMe} />
          </button>
          <Link
            className="ig-icon-btn"
            to={`/posts/${post.id}`}
            aria-label={`${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}, open post`}
          >
            <Icon name="comment" size={25} />
          </Link>
          <button
            type="button"
            className="ig-icon-btn"
            onClick={() => void share()}
            aria-label="Share post"
            title="Share"
          >
            <Icon name="share" size={24} />
          </button>
        </div>
        <button
          type="button"
          className={`ig-icon-btn ig-save${post.bookmarkedByMe ? " saved" : ""}${popped === "save" ? " pop" : ""}`}
          onClick={() => {
            if (bookmark.isPending) return;
            if (!post.bookmarkedByMe) {
              setPopped("save");
              tap();
            }
            bookmark.mutate(post.id);
          }}
          onAnimationEnd={() => setPopped(null)}
          aria-pressed={post.bookmarkedByMe}
          aria-label={post.bookmarkedByMe ? "Remove from saved" : "Save post"}
          title={post.bookmarkedByMe ? "Saved" : "Save"}
        >
          <Icon name="bookmark" size={25} filled={post.bookmarkedByMe} />
        </button>
      </div>
      <p className="ig-stats">
        <strong>
          {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
        </strong>
        {post.commentCount > 0 && (
          <Link to={`/posts/${post.id}`} className="muted">
            {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
          </Link>
        )}
      </p>
      {(like.isError || del.isError || bookmark.isError) && (
        <p className="error" role="alert">
          {del.isError
            ? "Could not delete this post. Try again."
            : bookmark.isError
              ? "Could not update your saved posts. Try again."
              : "Could not update your like. Try again."}
        </p>
      )}
      {reporting && <ReportForm postId={post.id} onClose={() => setReporting(false)} />}
      {heart && (
        <span
          key={heartKey}
          className="double-tap-heart"
          onAnimationEnd={() => setHeart(false)}
          aria-hidden="true"
        >
          <Icon name="heart" size={80} filled />
        </span>
      )}
    </article>
  );
}

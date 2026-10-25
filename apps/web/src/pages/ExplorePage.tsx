import { Fragment } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar";
import AdSlot, { FEED_AD_SLOT } from "../components/AdSlot";
import { timeAgo } from "../components/PostCard";
import { usePublicPosts } from "../hooks/usePublic";
import { assetUrl } from "../lib/api";
import { useAuth } from "../store/auth";

/** One ad after every N posts. */
const AD_EVERY = 5;

/**
 * Public, read-only page for visitors who aren't logged in (and for search engines and ad
 * reviewers). It is the only page that shows ads, because ads must only appear on pages that
 * Google's crawler can actually read, which the logged-in app is not.
 */
export default function ExplorePage() {
  const { user } = useAuth();
  const query = usePublicPosts();
  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <section className="card explore-hero">
        <h1>Explore Commune</h1>
        <p className="muted">
          An open source community platform. Read what people are sharing, then join the
          conversation.
        </p>
        {!user && (
          <div className="row">
            <Link className="btn" to="/register">
              Create an account
            </Link>
            <Link className="btn btn-outline" to="/login">
              Log in
            </Link>
          </div>
        )}
      </section>

      {query.isLoading && <p className="muted center">Loading…</p>}
      {query.isError && <p className="error center">{query.error.message}</p>}
      {query.isSuccess && posts.length === 0 && (
        <p className="muted center">Nothing here yet. Be the first to post!</p>
      )}

      {posts.map((post, i) => (
        <Fragment key={post.id}>
          <article className="card post post-head">
            <Avatar username={post.author.username} url={post.author.avatarUrl} />
            <div className="post-main">
              <div className="post-meta">
                <strong>@{post.author.username}</strong>
                <span className="muted">· {timeAgo(post.createdAt)}</span>
              </div>
              {post.content && <p className="post-body">{post.content}</p>}
              {post.imageUrl && (
                <img
                  className="post-image"
                  src={assetUrl(post.imageUrl)}
                  alt={`Image posted by @${post.author.username}`}
                  loading="lazy"
                />
              )}
              <p className="muted">
                ♥ {post.likeCount} · 💬 {post.commentCount} ·{" "}
                <Link to={user ? `/posts/${post.id}` : "/login"}>
                  {user ? "Open post" : "Log in to like and comment"}
                </Link>
              </p>
            </div>
          </article>
          {(i + 1) % AD_EVERY === 0 && <AdSlot slot={FEED_AD_SLOT} />}
        </Fragment>
      ))}

      {query.hasNextPage && (
        <button
          className="btn btn-ghost block"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}

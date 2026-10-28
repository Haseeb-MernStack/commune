import { Fragment } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import PlusBadge from "../components/PlusBadge";
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
      <section className="explore-hero">
        <div className="hero-art" aria-hidden="true">
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
        </div>
        <h1>A home for your communities</h1>
        <p>Post, follow people, chat and keep up with the news. Free to join and open source.</p>
        {!user && (
          <div className="row">
            <Link className="btn" to="/register">
              Create account
            </Link>
            <Link className="btn btn-outline" to="/login">
              Log in
            </Link>
          </div>
        )}
      </section>

      {query.isLoading && (
        <div aria-busy="true" aria-label="Loading posts">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton-post" />
          ))}
        </div>
      )}
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
                <strong className="user-link">@{post.author.username}</strong>
                <PlusBadge plus={post.author.plus} />
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
              <p className="post-foot muted">
                <span className="metric">
                  <Icon name="heart" size={17} /> {post.likeCount}
                </span>
                <span className="metric">
                  <Icon name="comment" size={17} /> {post.commentCount}
                </span>
                <Link to={user ? `/posts/${post.id}` : "/login"}>
                  {user ? "Open post" : "Log in to join in"}
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

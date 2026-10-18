import Composer from "../components/Composer";
import PostCard from "../components/PostCard";
import { useFeed } from "../hooks/usePosts";

export default function FeedPage() {
  const feed = useFeed();
  const posts = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <Composer />
      {feed.isLoading && <p className="muted center">Loading feed…</p>}
      {feed.isError && <p className="error center">{feed.error.message}</p>}
      {feed.isSuccess && posts.length === 0 && (
        <p className="muted center">No posts yet. Be the first to say something.</p>
      )}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {feed.hasNextPage && (
        <button
          className="btn btn-ghost block"
          onClick={() => void feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
        >
          {feed.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}

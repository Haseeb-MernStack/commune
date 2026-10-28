import PostCard from "./PostCard";
import type { useFeed } from "../hooks/usePosts";

/** Renders any infinite post query: loading, error, empty state, posts and "Load more". */
export default function PostList({
  query,
  emptyMessage,
}: {
  query: ReturnType<typeof useFeed>;
  emptyMessage: string;
}) {
  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      {query.isLoading && (
        <div aria-busy="true" aria-label="Loading posts">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton-post" />
          ))}
        </div>
      )}
      {query.isError && <p className="error center">{query.error.message}</p>}
      {query.isSuccess && posts.length === 0 && <p className="muted center">{emptyMessage}</p>}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
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

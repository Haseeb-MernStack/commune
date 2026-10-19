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
      {query.isLoading && <p className="muted center">Loading…</p>}
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

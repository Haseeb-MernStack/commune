import Icon from "./Icon";
import PostCard from "./PostCard";
import { PostListSkeleton } from "./Skeleton";
import { useLoadMoreOnVisible } from "../hooks/useInfiniteScroll";
import type { useFeed } from "../hooks/usePosts";

/** Renders any infinite post query: loading, error, empty state, posts and "Load more". */
export default function PostList({
  query,
  emptyMessage,
  highlight,
}: {
  query: ReturnType<typeof useFeed>;
  emptyMessage: string;
  highlight?: string;
}) {
  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  // Fetch the next page before the reader reaches the end.
  const sentinel = useLoadMoreOnVisible(
    () => void fetchNextPage(),
    hasNextPage && !isFetchingNextPage && !isError,
  );

  return (
    <>
      {query.isLoading && <PostListSkeleton />}
      {query.isError && (
        <p className="error center" role="alert">
          {query.error.message}
        </p>
      )}
      {query.isSuccess && posts.length === 0 && <p className="muted center">{emptyMessage}</p>}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} highlight={highlight} />
      ))}
      {isFetchingNextPage && <PostListSkeleton count={1} />}
      {query.hasNextPage && <div ref={sentinel} aria-hidden="true" />}
      {query.hasNextPage && !isFetchingNextPage && (
        <button className="btn btn-ghost block" onClick={() => void query.fetchNextPage()}>
          Load more
        </button>
      )}
      {query.isSuccess && posts.length > 0 && !hasNextPage && (
        <p className="muted center feed-end" role="status">
          <Icon name="check" size={16} />
          <span>{"You're all caught up"}</span>
        </p>
      )}
    </>
  );
}

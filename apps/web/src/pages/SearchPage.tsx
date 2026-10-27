import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import PlusBadge from "../components/PlusBadge";
import PostList from "../components/PostList";
import { useSearchPosts, useSearchUsers } from "../hooks/useSearch";

type Tab = "people" | "posts";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const tab: Tab = params.get("type") === "posts" ? "posts" : "people";
  const users = useSearchUsers(q);
  const posts = useSearchPosts(q);

  const choose = (next: Tab) => setParams({ q, type: next });
  const people = users.data?.pages.flatMap((p) => p.items) ?? [];

  if (q.length < 2) {
    return <p className="muted center">Type at least 2 characters in the search box.</p>;
  }

  return (
    <>
      <h1 className="search-title">Results for “{q}”</h1>
      <div className="tabs" role="tablist">
        {(["people", "posts"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => choose(t)}
          >
            {t === "people" ? "People" : "Posts"}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <>
          {users.isLoading && <p className="muted center">Searching…</p>}
          {users.isError && <p className="error center">{users.error.message}</p>}
          {users.isSuccess && people.length === 0 && (
            <p className="muted center">No people found. Search matches the start of a username.</p>
          )}
          {people.map((u) => (
            <Link key={u.id} to={`/u/${u.username}`} className="card person">
              <Avatar username={u.username} url={u.avatarUrl} size={44} />
              <div>
                <strong>@{u.username}</strong> <PlusBadge plus={u.plus} />
                {u.bio && <p className="muted">{u.bio}</p>}
              </div>
            </Link>
          ))}
          {users.hasNextPage && (
            <button
              className="btn btn-ghost block"
              onClick={() => void users.fetchNextPage()}
              disabled={users.isFetchingNextPage}
            >
              {users.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}

      {tab === "posts" && (
        <PostList query={posts} emptyMessage="No posts match those words." />
      )}
    </>
  );
}

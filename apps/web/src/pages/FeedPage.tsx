import { useState } from "react";
import Composer from "../components/Composer";
import PostList from "../components/PostList";
import PostCard from "../components/PostCard";
import { useFeed } from "../hooks/usePosts";
import type { FeedType } from "../hooks/usePosts";

const TABS: Array<{ id: FeedType; label: string; empty: string }> = [
  { id: "all", label: "Everyone", empty: "No posts yet. Be the first to say something." },
  {
    id: "following",
    label: "Following",
    empty: "Nothing here yet. Follow people from their profile to fill this feed.",
  },
];

export default function FeedPage() {
  const [tab, setTab] = useState<FeedType>("all");
  const feed = useFeed(tab);
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <Composer />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            className={`tab ${t.id === tab ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <PostList query={feed} emptyMessage={active.empty} />
    </>
  );
}

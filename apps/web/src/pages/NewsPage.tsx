import { useState } from "react";
import { NEWS_TOPICS, type NewsTopic } from "@commune/shared";
import { useNews } from "../hooks/useNews";
import { timeAgo } from "../components/PostCard";

const LABELS: Record<NewsTopic, string> = {
  top: "Top",
  world: "World",
  technology: "Tech",
  business: "Business",
  sport: "Sport",
};

export default function NewsPage() {
  const [topic, setTopic] = useState<NewsTopic>("top");
  const news = useNews(topic);

  return (
    <>
      <h1 className="search-title">Latest news</h1>
      <div className="tabs" role="tablist" aria-label="News topics">
        {NEWS_TOPICS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={topic === t}
            className={`tab${topic === t ? " active" : ""}`}
            onClick={() => setTopic(t)}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>

      {news.isLoading && <p className="muted center">Loading headlines…</p>}
      {news.isError && (
        <p className="error center">
          News is unavailable right now.{" "}
          <button className="link-btn" onClick={() => void news.refetch()}>
            Try again
          </button>
        </p>
      )}
      {news.data?.map((n) => (
        <a key={n.id} className="card news-card" href={n.link} target="_blank" rel="noopener noreferrer nofollow">
          <span className="muted small">
            {n.source} · {timeAgo(n.publishedAt)} ago
          </span>
          <strong>{n.title}</strong>
        </a>
      ))}
      <p className="muted small center">Headlines from BBC, NPR, The Guardian and Al Jazeera. Links open the publisher's site.</p>
    </>
  );
}

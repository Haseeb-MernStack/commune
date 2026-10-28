import { Link } from "react-router-dom";
import { useNews } from "../hooks/useNews";
import { timeAgo } from "./PostCard";

/** "What's happening": live headlines. Every item opens the publisher's own page. */
export default function NewsPanel({ limit = 4 }: { limit?: number }) {
  const news = useNews("top");

  return (
    <section className="card news-panel" aria-label="Latest news">
      <div className="news-head">
        <strong>What's happening</strong>
        <span className="live-dot" title="Updates automatically">
          Live
        </span>
      </div>

      {news.isLoading && (
        <div aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}

      {news.isError && (
        <p className="muted small">
          News is unavailable right now.{" "}
          <button className="link-btn" onClick={() => void news.refetch()}>
            Try again
          </button>
        </p>
      )}

      {news.data?.slice(0, limit).map((n) => (
        <a key={n.id} className="news-item" href={n.link} target="_blank" rel="noopener noreferrer nofollow">
          <span className="muted small">
            {n.source} · {timeAgo(n.publishedAt)} ago
          </span>
          <span className="news-title">{n.title}</span>
        </a>
      ))}

      <Link to="/news" className="news-more">
        Show more
      </Link>
    </section>
  );
}

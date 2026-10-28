import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { useInsights } from "../hooks/useBilling";
import { useAuth } from "../store/auth";

const nf = new Intl.NumberFormat("en-US");

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{nf.format(value)}</strong>
    </div>
  );
}

export default function InsightsPage() {
  const { user } = useAuth();
  const plus = Boolean(user?.plus);
  const insights = useInsights(plus);

  if (!plus) {
    return (
      <section className="card plus-hero">
        <h1>Insights</h1>
        <p>See how your posts perform: views, likes, comments and follower growth.</p>
        <Link className="btn" to="/plus">
          Get Commune Plus
        </Link>
      </section>
    );
  }
  if (insights.isLoading) return <p className="muted center">Loading…</p>;
  if (insights.isError || !insights.data) {
    return <p className="error center">{insights.error?.message ?? "Could not load insights."}</p>;
  }

  const { totals, daily, topPosts } = insights.data;
  const max = Math.max(1, ...daily.map((d) => d.views));
  const last30 = daily.reduce((sum, d) => sum + d.views, 0);

  return (
    <>
      <h1 className="search-title">Insights</h1>
      <div className="stats">
        <Stat label="Posts" value={totals.posts} />
        <Stat label="Views" value={totals.views} />
        <Stat label="Likes" value={totals.likes} />
        <Stat label="Comments" value={totals.comments} />
        <Stat label="Followers" value={totals.followers} />
        <Stat label="New followers (30d)" value={totals.newFollowers30d} />
      </div>

      <section className="card">
        <strong>Views, last 30 days</strong> <span className="muted">· {nf.format(last30)} total</span>
        <div className="bars" role="img" aria-label={`Daily views over the last 30 days, ${last30} in total`}>
          {daily.map((d) => (
            <div
              key={d.day}
              className="bar"
              style={{ height: `${Math.max(2, (d.views / max) * 100)}%` }}
              title={`${d.day}: ${d.views} views`}
            />
          ))}
        </div>
        <p className="muted small">
          Each person counts once per post per day. Your own views are not counted.
        </p>
      </section>

      <section className="card">
        <strong>Top posts</strong>
        {topPosts.length === 0 && <p className="muted">Post something to see how it performs.</p>}
        {topPosts.map((p) => (
          <Link key={p.id} to={`/posts/${p.id}`} className="top-post">
            <span>{p.content || "(image post)"}</span>
            <span className="muted">
              <span className="metric"><Icon name="eye" size={16} /> {nf.format(p.views)}</span>{" "}
              <span className="metric"><Icon name="heart" size={16} /> {nf.format(p.likes)}</span>{" "}
              <span className="metric"><Icon name="comment" size={16} /> {nf.format(p.comments)}</span>
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}

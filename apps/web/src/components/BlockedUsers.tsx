import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import { useBlocks, useRemoveBlock } from "../hooks/useBlocks";

/** Settings: people I muted or blocked, with a button to undo. */
export default function BlockedUsers() {
  const list = useBlocks();
  const remove = useRemoveBlock();
  const people = list.data ?? [];

  return (
    <section className="card privacy-settings" aria-labelledby="blocked-title">
      <h2 id="blocked-title" className="push-title">
        Muted and blocked
      </h2>
      <p className="muted small">
        Muted people's posts are hidden from you. Blocked people also can't follow, message or
        comment on you.
      </p>
      {list.isLoading && <p className="muted small">Loading…</p>}
      {list.isError && (
        <p className="error" role="alert">
          Could not load this list.
        </p>
      )}
      {list.isSuccess && people.length === 0 && (
        <p className="muted small">You haven't muted or blocked anyone.</p>
      )}
      <ul className="person-list">
        {people.map((p) => (
          <li key={p.id} className="person-row">
            <Link to={`/u/${p.username}`} className="person-main">
              <Avatar username={p.username} url={p.avatarUrl} size={40} />
              <span className="person-text">
                <span className="person-username">@{p.username}</span>
                <span className="muted small">{p.kind === "block" ? "Blocked" : "Muted"}</span>
              </span>
            </Link>
            <button
              className="btn btn-outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate(p.username)}
              aria-label={`${p.kind === "block" ? "Unblock" : "Unmute"} @${p.username}`}
            >
              {p.kind === "block" ? "Unblock" : "Unmute"}
            </button>
          </li>
        ))}
      </ul>
      {remove.isError && (
        <p className="error" role="alert">
          {remove.error.message}
        </p>
      )}
    </section>
  );
}

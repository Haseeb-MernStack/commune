import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useUnreadCount } from "../hooks/useSocial";
import { useUnreadMessages } from "../hooks/useMessages";
import Avatar from "./Avatar";
import PlusBadge from "./PlusBadge";

/** Twitter-style left column for logged-in users on wide screens. */
export default function LeftNav() {
  const { user } = useAuth();
  const notifications = useUnreadCount(Boolean(user));
  const messages = useUnreadMessages(Boolean(user));
  if (!user) return null;

  const n = notifications.data?.count ?? 0;
  const m = messages.data?.count ?? 0;
  const cls = ({ isActive }: { isActive: boolean }) => `side-link${isActive ? " active" : ""}`;
  const badge = (count: number) => (count > 0 ? <span className="pill">{count > 99 ? "99+" : count}</span> : null);

  return (
    <aside className="left-nav" aria-label="Primary">
      <nav>
        <NavLink to="/" end className={cls}>
          <span className="side-icon" aria-hidden>🏠</span>
          <span className="side-label">Home</span>
        </NavLink>
        <NavLink to="/explore" className={cls}>
          <span className="side-icon" aria-hidden>🧭</span>
          <span className="side-label">Explore</span>
        </NavLink>
        <NavLink to="/news" className={cls}>
          <span className="side-icon" aria-hidden>📰</span>
          <span className="side-label">News</span>
        </NavLink>
        <NavLink to="/communities" className={cls}>
          <span className="side-icon" aria-hidden>👥</span>
          <span className="side-label">Communities</span>
        </NavLink>
        <NavLink to="/notifications" className={cls} aria-label={`Notifications, ${n} unread`}>
          <span className="side-icon" aria-hidden>🔔</span>
          <span className="side-label">Notifications</span>
          {badge(n)}
        </NavLink>
        <NavLink to="/messages" className={cls} aria-label={`Messages, ${m} unread`}>
          <span className="side-icon" aria-hidden>✉️</span>
          <span className="side-label">Messages</span>
          {badge(m)}
        </NavLink>
        <NavLink to={`/u/${user.username}`} className={cls}>
          <span className="side-icon" aria-hidden>👤</span>
          <span className="side-label">Profile</span>
        </NavLink>
        <NavLink to={user.plus ? "/insights" : "/plus"} className={cls}>
          <span className="side-icon" aria-hidden>{user.plus ? "📊" : "✦"}</span>
          <span className="side-label">{user.plus ? "Insights" : "Commune Plus"}</span>
        </NavLink>
        {user.role === "admin" && (
          <NavLink to="/admin" className={cls}>
            <span className="side-icon" aria-hidden>🛡️</span>
            <span className="side-label">Admin</span>
          </NavLink>
        )}
        <NavLink to="/contact" className={cls}>
          <span className="side-icon" aria-hidden>📬</span>
          <span className="side-label">Contact</span>
        </NavLink>
      </nav>
      <Link to="/" className="btn side-post">
        <span aria-hidden>✎</span>
        <span className="side-label">Post</span>
      </Link>
      <Link to={`/u/${user.username}`} className="side-me">
        <Avatar username={user.username} url={user.avatarUrl} size={36} />
        <span className="side-label">
          @{user.username} <PlusBadge plus={user.plus} />
        </span>
      </Link>
    </aside>
  );
}

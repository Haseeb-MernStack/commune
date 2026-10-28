import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useUnreadCount } from "../hooks/useSocial";
import { useUnreadMessages } from "../hooks/useMessages";
import Avatar from "./Avatar";
import Brand from "./BrandMark";
import Icon, { type IconName } from "./Icon";
import PlusBadge from "./PlusBadge";

/** Left column for members on wide screens: brand, navigation, and the account at the bottom. */
export default function LeftNav() {
  const { user, logout } = useAuth();
  const notifications = useUnreadCount(Boolean(user));
  const messages = useUnreadMessages(Boolean(user));
  if (!user) return null;

  const n = notifications.data?.count ?? 0;
  const m = messages.data?.count ?? 0;
  const cls = ({ isActive }: { isActive: boolean }) => `side-link${isActive ? " active" : ""}`;
  const badge = (count: number) => (count > 0 ? <span className="pill">{count > 99 ? "99+" : count}</span> : null);
  const link = (to: string, icon: IconName, label: string, count = 0, end = false) => (
    <NavLink to={to} end={end} className={cls} aria-label={count ? `${label}, ${count} unread` : undefined}>
      <span className="side-icon">
        <Icon name={icon} size={24} />
      </span>
      <span className="side-label">{label}</span>
      {badge(count)}
    </NavLink>
  );

  return (
    <aside className="left-nav" aria-label="Primary">
      <Link to="/" className="side-brand" aria-label="Commune home">
        <Brand size={34} />
      </Link>
      <nav>
        {link("/", "home", "Home", 0, true)}
        {link("/explore", "compass", "Explore")}
        {link("/news", "news", "News")}
        {link("/communities", "users", "Communities")}
        {link("/notifications", "bell", "Notifications", n)}
        {link("/messages", "mail", "Messages", m)}
        {link(`/u/${user.username}`, "user", "Profile")}
        {link(user.plus ? "/insights" : "/plus", user.plus ? "chart" : "sparkle", user.plus ? "Insights" : "Commune Plus")}
        {user.role === "admin" && link("/admin", "shield", "Admin")}
        {link("/contact", "contact", "Contact")}
      </nav>
      <Link to="/" className="btn side-post" aria-label="Write a post">
        <Icon name="pencil" size={20} />
        <span className="side-label">Post</span>
      </Link>
      <div className="side-me">
        <Link to={`/u/${user.username}`} className="side-me-link">
          <Avatar username={user.username} url={user.avatarUrl} size={38} />
          <span className="side-label">
            @{user.username} <PlusBadge plus={user.plus} />
          </span>
        </Link>
        <button className="icon-btn side-logout" onClick={() => void logout()} aria-label="Log out" title="Log out">
          <Icon name="logout" size={20} />
        </button>
      </div>
    </aside>
  );
}

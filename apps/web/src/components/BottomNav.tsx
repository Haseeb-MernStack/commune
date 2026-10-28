import { NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useUnreadCount } from "../hooks/useSocial";
import { useUnreadMessages } from "../hooks/useMessages";
import Avatar from "./Avatar";
import Icon, { type IconName } from "./Icon";

/** App-style tab bar for members on phones and tablets. The menu button holds everything else. */
export default function BottomNav() {
  const { user } = useAuth();
  const notifications = useUnreadCount(Boolean(user));
  const messages = useUnreadMessages(Boolean(user));
  if (!user) return null;

  const n = notifications.data?.count ?? 0;
  const m = messages.data?.count ?? 0;
  const cls = ({ isActive }: { isActive: boolean }) => `tab-link${isActive ? " active" : ""}`;
  const tab = (to: string, icon: IconName, label: string, count = 0, end = false) => (
    <NavLink to={to} end={end} className={cls} aria-label={count ? `${label}, ${count} unread` : label}>
      <span className="tab-icon">
        <Icon name={icon} size={25} />
        {count > 0 && <span className="dot" aria-hidden="true" />}
      </span>
      <span className="tab-label">{label}</span>
    </NavLink>
  );

  return (
    <nav className="bottom-nav" aria-label="Tabs">
      {tab("/", "home", "Home", 0, true)}
      {tab("/news", "news", "News")}
      {tab("/messages", "mail", "Messages", m)}
      {tab("/notifications", "bell", "Alerts", n)}
      <NavLink to={`/u/${user.username}`} className={cls} aria-label="Profile">
        <span className="tab-icon">
          <Avatar username={user.username} url={user.avatarUrl} size={26} />
        </span>
        <span className="tab-label">Me</span>
      </NavLink>
    </nav>
  );
}

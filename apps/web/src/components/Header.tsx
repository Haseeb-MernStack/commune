import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useUnreadCount } from "../hooks/useSocial";
import { useUnreadMessages } from "../hooks/useMessages";
import Avatar from "./Avatar";
import Brand from "./BrandMark";
import Icon, { type IconName } from "./Icon";
import PlusBadge from "./PlusBadge";
import SearchBox from "./SearchBox";

/** Pages where the navbar is hidden so sign-in flows stay focused. */
export const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export default function Header() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const unread = useUnreadCount(Boolean(user));
  const msgs = useUnreadMessages(Boolean(user));
  const [open, setOpen] = useState(false);
  const count = unread.data?.count ?? 0;
  const msgCount = msgs.data?.count ?? 0;
  const countLabel = count > 99 ? "99+" : String(count);

  // Close the drawer whenever the page changes.
  useEffect(() => setOpen(false), [pathname]);

  // While the drawer is open: Escape closes it and the page behind it does not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // If the window grows to desktop size, make sure no stale drawer stays open.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (AUTH_PATHS.includes(pathname)) return null;

  const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " active" : ""}`;
  const item = (to: string, icon: IconName, label: string, extra?: ReactNode, end = false) => (
    <NavLink to={to} end={end} className={navClass}>
      <Icon name={icon} size={20} />
      {label}
      {extra}
    </NavLink>
  );

  return (
    <>
      <header className={`header${user ? " header-user" : ""}`}>
        <Link to="/" className="brand" aria-label="Commune home">
          <Brand size={30} />
        </Link>

        {user && (
          <div className="header-search">
            <SearchBox />
          </div>
        )}

        {/* Desktop navigation (wide screens with the left menu hide this bar for members) */}
        <nav className="header-right nav-desktop" aria-label="Main">
          {!user && (
            <>
              <NavLink to="/explore" className={navClass}>
                Explore
              </NavLink>
              <NavLink to="/news" className={navClass}>
                News
              </NavLink>
              <Link to="/login" className="nav-link">
                Log in
              </Link>
              <Link to="/register" className="btn">
                Sign up
              </Link>
            </>
          )}
          {user && (
            <>
              <Link to={`/u/${user.username}`} className="nav-link nav-profile">
                <Avatar username={user.username} url={user.avatarUrl} size={26} />@{user.username}
                <PlusBadge plus={user.plus} />
              </Link>
              <button className="btn btn-ghost" onClick={() => void logout()}>
                Log out
              </button>
            </>
          )}
        </nav>

        {/* Mobile / tablet controls */}
        <div className="nav-mobile">
          {user && (
            <Link to="/search" className="icon-btn" aria-label="Search">
              <Icon name="search" size={22} />
            </Link>
          )}
          <button
            className="icon-btn"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? "close" : "menu"} size={24} />
          </button>
        </div>
      </header>

      {/* Slide-in menu (right side) */}
      <div className={`drawer-root${open ? " open" : ""}`} aria-hidden={!open}>
        <button className="drawer-overlay" tabIndex={-1} aria-label="Close menu" onClick={() => setOpen(false)} />
        <aside id="mobile-menu" className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
          {user ? (
            <>
              <Link to={`/u/${user.username}`} className="drawer-profile">
                <Avatar username={user.username} url={user.avatarUrl} size={48} />
                <span>
                  <strong>
                    @{user.username} <PlusBadge plus={user.plus} />
                  </strong>
                  <small className="muted">View profile</small>
                </span>
              </Link>
              <nav className="drawer-links" aria-label="Menu">
                {item("/", "home", "Home", undefined, true)}
                {item("/communities", "users", "Communities")}
                {item("/news", "news", "News")}
                {item("/notifications", "bell", "Notifications", count > 0 && <span className="pill">{countLabel}</span>)}
                {item("/messages", "mail", "Messages", msgCount > 0 && <span className="pill">{msgCount}</span>)}
                {item(user.plus ? "/insights" : "/plus", user.plus ? "chart" : "sparkle", user.plus ? "Insights" : "Commune Plus")}
                {user.plus && item("/plus", "card", "Billing")}
                {user.role === "admin" && item("/admin", "shield", "Admin")}
                {item("/contact", "contact", "Contact")}
              </nav>
              <button className="btn btn-outline block" onClick={() => void logout()}>
                <Icon name="logout" size={18} /> Log out
              </button>
            </>
          ) : (
            <>
              <nav className="drawer-links" aria-label="Menu">
                {item("/", "home", "Home", undefined, true)}
                {item("/explore", "compass", "Explore")}
                {item("/news", "news", "News")}
                {item("/contact", "contact", "Contact")}
              </nav>
              <Link to="/register" className="btn block">
                Create account
              </Link>
              <Link to="/login" className="btn btn-outline block">
                Log in
              </Link>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useUnreadCount } from "../hooks/useSocial";
import Avatar from "./Avatar";
import PlusBadge from "./PlusBadge";
import SearchBox from "./SearchBox";

/** Pages where the navbar is hidden so sign-in flows stay focused. */
export const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const unread = useUnreadCount(Boolean(user));
  const [open, setOpen] = useState(false);
  const count = unread.data?.count ?? 0;
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

  return (
    <>
      <header className="header">
        <Link to="/" className="brand">
          Commune
        </Link>

        {user && (
          <div className="header-search">
            <SearchBox />
          </div>
        )}

        {/* Desktop navigation */}
        <nav className="header-right nav-desktop" aria-label="Main">
          {!user && (
            <>
              <NavLink to="/explore" className={navClass}>
                Explore
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
              {user.role === "admin" && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
              <NavLink to="/communities" className={navClass}>
                Communities
              </NavLink>
              <NavLink
                to={user.plus ? "/insights" : "/plus"}
                className={({ isActive }) => `${navClass({ isActive })} plus-link`}
              >
                {user.plus ? "Insights" : "✦ Plus"}
              </NavLink>
              <NavLink
                to="/notifications"
                className={navClass}
                aria-label={`Notifications, ${count} unread`}
              >
                🔔
                {count > 0 && <span className="badge">{countLabel}</span>}
              </NavLink>
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
            <Link
              to="/notifications"
              className="icon-btn"
              aria-label={`Notifications, ${count} unread`}
            >
              🔔
              {count > 0 && <span className="badge">{countLabel}</span>}
            </Link>
          )}
          <button
            className="icon-btn"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </header>

      {/* Slide-in menu (right side) */}
      <div className={`drawer-root${open ? " open" : ""}`} aria-hidden={!open}>
        <button
          className="drawer-overlay"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
        <aside
          id="mobile-menu"
          className="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          {user ? (
            <>
              <Link to={`/u/${user.username}`} className="drawer-profile">
                <Avatar username={user.username} url={user.avatarUrl} size={44} />
                <span>
                  <strong>
                    @{user.username} <PlusBadge plus={user.plus} />
                  </strong>
                  <small className="muted">View profile</small>
                </span>
              </Link>
              <SearchBox />
              <nav className="drawer-links" aria-label="Menu">
                <NavLink to="/" end className={navClass}>
                  🏠 Home
                </NavLink>
                <NavLink to="/communities" className={navClass}>
                  👥 Communities
                </NavLink>
                <NavLink to="/notifications" className={navClass}>
                  🔔 Notifications{count > 0 && <span className="pill">{countLabel}</span>}
                </NavLink>
                <NavLink to={user.plus ? "/insights" : "/plus"} className={navClass}>
                  {user.plus ? "📊 Insights" : "✦ Commune Plus"}
                </NavLink>
                {user.plus && (
                  <NavLink to="/plus" className={navClass}>
                    ⚙️ Billing
                  </NavLink>
                )}
                {user.role === "admin" && (
                  <NavLink to="/admin" className={navClass}>
                    🛡️ Admin
                  </NavLink>
                )}
              </nav>
              <button className="btn btn-outline block" onClick={() => void logout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <nav className="drawer-links" aria-label="Menu">
                <NavLink to="/" end className={navClass}>
                  🏠 Home
                </NavLink>
                <NavLink to="/explore" className={navClass}>
                  🧭 Explore
                </NavLink>
              </nav>
              <Link to="/register" className="btn block">
                Sign up
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

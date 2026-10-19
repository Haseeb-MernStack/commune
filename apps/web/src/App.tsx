import { Link, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./store/auth";
import { useUnreadCount } from "./hooks/useSocial";
import FeedPage from "./pages/FeedPage";
import PostPage from "./pages/PostPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function Header() {
  const { user, logout } = useAuth();
  const unread = useUnreadCount(Boolean(user));
  const count = unread.data?.count ?? 0;

  return (
    <header className="header">
      <Link to="/" className="brand">
        commune
      </Link>
      {user && (
        <nav className="header-right">
          <Link
            to="/notifications"
            className="nav-link"
            aria-label={`Notifications, ${count} unread`}
          >
            🔔
            {count > 0 && <span className="badge">{count > 99 ? "99+" : count}</span>}
          </Link>
          <Link to={`/u/${user.username}`} className="nav-link">
            @{user.username}
          </Link>
          <button className="btn btn-ghost" onClick={() => void logout()}>
            Log out
          </button>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <Protected>
                <FeedPage />
              </Protected>
            }
          />
          <Route
            path="/posts/:id"
            element={
              <Protected>
                <PostPage />
              </Protected>
            }
          />
          <Route
            path="/u/:username"
            element={
              <Protected>
                <ProfilePage />
              </Protected>
            }
          />
          <Route
            path="/notifications"
            element={
              <Protected>
                <NotificationsPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

import { Link, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./store/auth";
import { useUnreadCount } from "./hooks/useSocial";
import Avatar from "./components/Avatar";
import FeedPage from "./pages/FeedPage";
import PostPage from "./pages/PostPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import AdminPage from "./pages/AdminPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPassword";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import VerifyBanner from "./components/VerifyBanner";
import SearchPage from "./pages/SearchPage";
import SearchBox from "./components/SearchBox";
import PwaBanner from "./components/PwaBanner";

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
        Commune
      </Link>
      {user && <SearchBox />}{" "}
      {user && (
        <nav className="header-right">
          {user.role === "admin" && (
            <Link to="/admin" className="nav-link">
              Admin
            </Link>
          )}
          <Link
            to="/notifications"
            className="nav-link"
            aria-label={`Notifications, ${count} unread`}
          >
            🔔
            {count > 0 && <span className="badge">{count > 99 ? "99+" : count}</span>}
          </Link>
          <Link to={`/u/${user.username}`} className="nav-link nav-profile">
            <Avatar username={user.username} url={user.avatarUrl} size={26} />@{user.username}
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
      <VerifyBanner /> <PwaBanner />
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
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
          <Route
            path="/admin"
            element={
              <Protected>
                <AdminPage />
              </Protected>
            }
          />

          <Route
            path="/search"
            element={
              <Protected>
                <SearchPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

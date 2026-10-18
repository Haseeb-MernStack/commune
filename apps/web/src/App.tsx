import { Link, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./store/auth";
import FeedPage from "./pages/FeedPage";
import PostPage from "./pages/PostPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="header">
      <Link to="/" className="brand">
        commune
      </Link>
      {user && (
        <div className="header-right">
          <span className="muted">@{user.username}</span>
          <button className="btn btn-ghost" onClick={() => void logout()}>
            Log out
          </button>
        </div>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./store/auth";
import Header, { AUTH_PATHS } from "./components/Header";
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
import PwaBanner from "./components/PwaBanner";
import ExplorePage from "./pages/ExplorePage";
import CommunitiesPage from "./pages/CommunitiesPage";
import CommunityPage from "./pages/CommunityPage";
import LeftNav from "./components/LeftNav";
import RightRail from "./components/RightRail";
import MessagesPage from "./pages/MessagesPage";
import NewsPage from "./pages/NewsPage";
import ContactPage from "./pages/ContactPage";
import PlusPage from "./pages/PlusPage";
import InsightsPage from "./pages/InsightsPage";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

/** "/" shows the feed to members and the public Explore page to everyone else. */
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  return user ? <FeedPage /> : <ExplorePage />;
}

export default function App() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const authPage = AUTH_PATHS.includes(pathname);
  // Messages need room for two panes, so that page drops the news column.
  const wide = pathname.startsWith("/messages");
  return (
    <>
      <Header />
      {!authPage && <VerifyBanner />}
      <PwaBanner />
      <div className={authPage ? "shell-auth" : `shell${user ? " has-left" : ""}${wide ? " wide" : ""}`}>
      {!authPage && user && <LeftNav />}
      <main className={authPage ? "container container-auth" : "container"}>
        {authPage && (
          <Link to="/" className="brand auth-brand">
            Commune
          </Link>
        )}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/" element={<Home />} />
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
            path="/communities"
            element={
              <Protected>
                <CommunitiesPage />
              </Protected>
            }
          />
          <Route
            path="/c/:slug"
            element={
              <Protected>
                <CommunityPage />
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
          <Route
            path="/plus"
            element={
              <Protected>
                <PlusPage />
              </Protected>
            }
          />
          <Route
            path="/insights"
            element={
              <Protected>
                <InsightsPage />
              </Protected>
            }
          />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route
            path="/messages"
            element={
              <Protected>
                <MessagesPage />
              </Protected>
            }
          />
          <Route
            path="/messages/:id"
            element={
              <Protected>
                <MessagesPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!authPage && !wide && <RightRail />}
      </div>
    </>
  );
}

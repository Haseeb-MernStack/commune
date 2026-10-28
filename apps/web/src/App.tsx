import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./store/auth";
import Header, { AUTH_PATHS } from "./components/Header";
import FeedPage from "./pages/FeedPage";
import VerifyBanner from "./components/VerifyBanner";
import PwaBanner from "./components/PwaBanner";
import ExplorePage from "./pages/ExplorePage";
import LeftNav from "./components/LeftNav";
import RightRail from "./components/RightRail";
import BottomNav from "./components/BottomNav";
import Brand from "./components/BrandMark";
import Icon from "./components/Icon";

const PostPage = lazy(() => import("./pages/PostPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CommunitiesPage = lazy(() => import("./pages/CommunitiesPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const PlusPage = lazy(() => import("./pages/PlusPage"));
const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const NewsPage = lazy(() => import("./pages/NewsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));

const TITLES: Record<string, string> = {
  "/": "Commune: an open source community platform",
  "/explore": "Explore",
  "/news": "Latest news",
  "/contact": "Contact",
  "/plus": "Commune Plus",
  "/insights": "Insights",
  "/messages": "Messages",
  "/communities": "Communities",
  "/notifications": "Notifications",
  "/search": "Search",
  "/login": "Log in",
  "/register": "Sign up",
  "/forgot-password": "Forgot password",
  "/reset-password": "Reset password",
  "/admin": "Admin",
};

/** Per-page browser title and canonical link, so tabs, history and search engines get real names. */
function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const user = /^\/u\/([^/]+)/.exec(pathname)?.[1];
    const community = /^\/c\/([^/]+)/.exec(pathname)?.[1];
    const name =
      TITLES[pathname] ??
      (user ? `@${decodeURIComponent(user)}` : community ? `c/${decodeURIComponent(community)}` : pathname.startsWith("/messages") ? "Messages" : pathname.startsWith("/posts/") ? "Post" : "Commune");
    document.title = pathname === "/" ? name : `${name} · Commune`;

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `${window.location.origin}${pathname}`;

    // Move keyboard and screen-reader focus to the page content after navigating.
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

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

function AppRoutes() {
  return (
    <Suspense fallback={<p className="muted center route-loading">Loading…</p>}>
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
    </Suspense>
  );
}

/** Left panel of the sign-in screens (hidden on phones). */
function AuthArt() {
  return (
    <aside className="auth-art" aria-hidden="true">
      <Brand size={40} />
      <div className="auth-art-body">
        <p className="art-title">Your people, your news, one open place.</p>
        <ul>
          <li>
            <Icon name="users" size={20} /> Join communities and follow people
          </li>
          <li>
            <Icon name="mail" size={20} /> Message friends privately
          </li>
          <li>
            <Icon name="news" size={20} /> Live news beside your feed
          </li>
        </ul>
      </div>
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
    </aside>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const authPage = AUTH_PATHS.includes(pathname);
  // Messages need room for two panes, so that page drops the news column.
  const wide = pathname.startsWith("/messages");

  const skip = (
    <a href="#main" className="skip-link">
      Skip to content
    </a>
  );

  if (authPage) {
    return (
      <>
        {skip}
        <RouteMeta />
        <PwaBanner />
        <div className="auth-split">
          <AuthArt />
          <main id="main" tabIndex={-1} className="auth-main">
            <Link to="/" className="auth-brand" aria-label="Commune home">
              <Brand size={36} />
            </Link>
            <AppRoutes />
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      {skip}
      <RouteMeta />
      <Header />
      <VerifyBanner />
      <PwaBanner />
      <div className={`shell${user ? " has-left" : ""}${wide ? " wide" : ""}`}>
        {user && <LeftNav />}
        <main id="main" tabIndex={-1} className="container">
          <AppRoutes />
        </main>
        {!wide && <RightRail />}
      </div>
      <BottomNav />
    </>
  );
}

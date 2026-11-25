import { Link } from "react-router-dom";
import { useAuth } from "../store/auth";
import { openCookieSettings } from "../lib/consent";
import { REPO_URL } from "../lib/links";
import NewsPanel from "./NewsPanel";
import SearchBox from "./SearchBox";

/** Right column on wide screens: live news and small footer links. */
export default function RightRail() {
  const { user } = useAuth();
  return (
    <aside className="right-rail" aria-label="News and links">
      {user && (
        <div className="rail-search">
          <SearchBox />
        </div>
      )}
      <NewsPanel />
      <nav className="rail-links muted small" aria-label="Footer">
        <Link to="/explore">Explore</Link>
        <Link to="/plus">Plus</Link>
        <Link to="/help">Help</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <button type="button" className="rail-link-btn" onClick={openCookieSettings}>
          Cookie settings
        </button>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </nav>
      <p className="muted small">© {new Date().getFullYear()} Commune · Open source</p>
    </aside>
  );
}

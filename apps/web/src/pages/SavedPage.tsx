import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import PostList from "../components/PostList";
import { useSaved } from "../hooks/useBookmarks";

/** The posts this person saved with the bookmark button. Only they can see this list. */
export default function SavedPage() {
  const query = useSaved();
  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];
  const isEmpty = query.isSuccess && posts.length === 0;

  return (
    <>
      <h1 className="page-title">Saved</h1>
      <p className="muted saved-note">Only you can see what you save.</p>
      {isEmpty ? (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            <Icon name="bookmark" size={28} />
          </span>
          <p className="empty-state-title">Nothing saved yet</p>
          <p className="muted empty-state-body">
            Tap the bookmark on a post to keep it here for later.
          </p>
          <Link className="btn" to="/explore">
            Browse Explore
          </Link>
        </div>
      ) : (
        <PostList
          query={query}
          emptyMessage="Nothing saved yet. Tap the bookmark on a post to keep it here."
        />
      )}
    </>
  );
}

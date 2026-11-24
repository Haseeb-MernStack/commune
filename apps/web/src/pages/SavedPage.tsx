import PostList from "../components/PostList";
import { useSaved } from "../hooks/useBookmarks";

/** The posts this person saved with the bookmark button. Only they can see this list. */
export default function SavedPage() {
  const query = useSaved();
  return (
    <>
      <h1 className="page-title">Saved</h1>
      <p className="muted saved-note">Only you can see what you save.</p>
      <PostList
        query={query}
        emptyMessage="Nothing saved yet. Tap the bookmark on a post to keep it here."
      />
    </>
  );
}

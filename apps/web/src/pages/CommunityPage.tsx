import { Link, useParams } from "react-router-dom";
import Composer from "../components/Composer";
import PostList from "../components/PostList";
import { useCommunity, useCommunityPosts, useMembership } from "../hooks/useCommunities";

export default function CommunityPage() {
  const { slug = "" } = useParams();
  const community = useCommunity(slug);
  const posts = useCommunityPosts(slug);
  const { join, leave } = useMembership(slug);

  if (community.isLoading) return <p className="muted center">Loading…</p>;
  if (community.isError || !community.data) {
    return (
      <p className="error center">
        Community not found. <Link to="/communities">Browse communities</Link>
      </p>
    );
  }

  const c = community.data;
  const busy = join.isPending || leave.isPending;

  return (
    <>
      <Link to="/communities" className="muted">
        ← All communities
      </Link>
      <section className="card community-head">
        <div className="row between">
          <div>
            <h1 className="community-title">{c.name}</h1>
            <p className="muted">
              c/{c.slug} · {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
              {c.myRole === "owner" && " · You own this"}
            </p>
          </div>
          {c.myRole !== "owner" &&
            (c.joinedByMe ? (
              <button className="btn btn-outline" disabled={busy} onClick={() => leave.mutate()}>
                Joined ✓
              </button>
            ) : (
              <button className="btn" disabled={busy} onClick={() => join.mutate()}>
                Join
              </button>
            ))}
        </div>
        {c.description && <p>{c.description}</p>}
        {(join.isError || leave.isError) && (
          <p className="error">{(join.error ?? leave.error)?.message}</p>
        )}
      </section>

      {c.joinedByMe ? (
        <Composer communitySlug={c.slug} />
      ) : (
        <p className="muted center">Join this community to post in it.</p>
      )}
      <PostList query={posts} emptyMessage="No posts here yet. Start the conversation." />
    </>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import PostList from "../components/PostList";
import { useProfile, useToggleFollow, useUpdateProfile, useUserPosts } from "../hooks/useSocial";
import { useAuth } from "../store/auth";

export default function ProfilePage() {
  const { username = "" } = useParams();
  const { user: me } = useAuth();
  const profile = useProfile(username);
  const posts = useUserPosts(username);
  const follow = useToggleFollow(username);
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");

  if (profile.isLoading) return <p className="muted center">Loading…</p>;
  if (profile.isError || !profile.data) return <p className="error center">User not found.</p>;

  const p = profile.data;
  const isMe = me?.id === p.id;

  const startEditing = () => {
    setBio(p.bio);
    setEditing(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(bio, { onSuccess: () => setEditing(false) });
  };

  return (
    <>
      <section className="card profile">
        <div className="profile-top">
          <div>
            <h1 className="profile-name">@{p.username}</h1>
            <p className="muted">Joined {new Date(p.createdAt).toLocaleDateString()}</p>
          </div>
          {isMe ? (
            !editing && (
              <button className="btn btn-outline" onClick={startEditing}>
                Edit bio
              </button>
            )
          ) : (
            <button
              className={`btn ${p.followedByMe ? "btn-outline" : ""}`}
              onClick={() => follow.mutate()}
              disabled={follow.isPending}
            >
              {p.followedByMe ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={save} className="profile-edit">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Tell the community about yourself"
            />
            <div className="composer-footer">
              <span className="muted">{bio.length}/160</span>
              <span className="row">
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button className="btn" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save"}
                </button>
              </span>
            </div>
            {update.isError && <p className="error">{update.error.message}</p>}
          </form>
        ) : (
          <p className="profile-bio">{p.bio || (isMe ? "Add a bio so people know who you are." : "")}</p>
        )}

        {follow.isError && <p className="error">{follow.error.message}</p>}

        <div className="profile-stats">
          <span>
            <strong>{p.followerCount}</strong> <span className="muted">followers</span>
          </span>
          <span>
            <strong>{p.followingCount}</strong> <span className="muted">following</span>
          </span>
        </div>
      </section>

      <PostList query={posts} emptyMessage="No posts yet." />
    </>
  );
}

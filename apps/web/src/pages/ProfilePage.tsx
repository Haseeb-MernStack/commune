import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import PlusBadge from "../components/PlusBadge";
import EarningsCard from "../components/EarningsCard";
import PostList from "../components/PostList";
import { useProfile, useToggleFollow, useUpdateProfile, useUserPosts } from "../hooks/useSocial";
import { useBanUser, useUnbanUser } from "../hooks/useModeration";
import { useUploadImage } from "../hooks/useUpload";
import { validateImage } from "../lib/images";
import { useAuth } from "../store/auth";

export default function ProfilePage() {
  const { username = "" } = useParams();
  const { user: me } = useAuth();
  const profile = useProfile(username);
  const posts = useUserPosts(username);
  const follow = useToggleFollow(username);
  const update = useUpdateProfile();
  const upload = useUploadImage("avatar");
  const ban = useBanUser(username);
  const unban = useUnbanUser(username);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (profile.isLoading) return <p className="muted center">Loading…</p>;
  if (profile.isError || !profile.data) return <p className="error center">User not found.</p>;

  const p = profile.data;
  const isMe = me?.id === p.id;
  const photoBusy = upload.isPending || update.isPending;
  const isAdmin = me?.role === "admin";

  const suspend = () => {
    if (!window.confirm(`Suspend @${p.username}? They will be logged out and unable to post.`)) return;
    const removePosts = window.confirm("Also delete all of their posts?");
    ban.mutate(removePosts);
  };

  const startEditing = () => {
    setBio(p.bio);
    setEditing(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ bio }, { onSuccess: () => setEditing(false) });
  };

  const pickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    setPhotoError(null);
    upload.mutate(file, {
      onSuccess: ({ url }) =>
        update.mutate({ avatarUrl: url }, { onError: (err) => setPhotoError(err.message) }),
      onError: (err) => setPhotoError(err.message),
    });
  };

  return (
    <>
      <section className="card profile">
        <div className="profile-top">
          <div className="profile-id">
            <Avatar username={p.username} url={p.avatarUrl} size={72} />
            <div>
              <h1 className="profile-name">
                @{p.username} <PlusBadge plus={p.plus} />
              </h1>
              <p className="muted">Joined {new Date(p.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          {isMe ? (
            !editing && (
              <button className="btn btn-outline" onClick={startEditing}>
                Edit profile
              </button>
            )
          ) : (
            <div className="row">
              <Link className="btn btn-outline" to={`/messages?to=${encodeURIComponent(p.username)}`}>
                <Icon name="mail" size={18} /> Message
              </Link>
              <button
                className={`btn ${p.followedByMe ? "btn-outline" : ""}`}
                onClick={() => follow.mutate()}
                disabled={follow.isPending}
              >
                {p.followedByMe ? "Following" : "Follow"}
              </button>
            </div>
          )}
        </div>

        {isMe && <EarningsCard />}

        {isMe && editing && (
          <div className="row">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={pickPhoto}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
            >
              {photoBusy
                ? upload.progress ? `Uploading ${upload.progress}%` : "Saving photo…"
                : "Change photo"}
            </button>
            {p.avatarUrl && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => update.mutate({ avatarUrl: null })}
                disabled={photoBusy}
              >
                Remove photo
              </button>
            )}
          </div>
        )}
        {photoError && <p className="error">{photoError}</p>}

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
                  Done
                </button>
                <button className="btn" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save bio"}
                </button>
              </span>
            </div>
            {update.isError && <p className="error">{update.error.message}</p>}
          </form>
        ) : (
          <p className="profile-bio">
            {p.bio || (isMe ? "Add a bio so people know who you are." : "")}
          </p>
        )}

        {follow.isError && <p className="error">{follow.error.message}</p>}

        {p.banned && <p className="suspended">This account is suspended.</p>}
        {isAdmin && !isMe && p.role !== "admin" && (
          <div className="row">
            {p.banned ? (
              <button
                className="btn btn-outline"
                onClick={() => unban.mutate()}
                disabled={unban.isPending}
              >
                Lift suspension
              </button>
            ) : (
              <button className="btn btn-danger" onClick={suspend} disabled={ban.isPending}>
                Suspend user
              </button>
            )}
          </div>
        )}
        {(ban.isError || unban.isError) && (
          <p className="error">{(ban.error ?? unban.error)?.message}</p>
        )}

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

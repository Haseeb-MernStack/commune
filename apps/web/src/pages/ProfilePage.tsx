import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import AvatarEditor, { PhotoNotice } from "../components/AvatarEditor";
import EarningsCard from "../components/EarningsCard";
import Icon from "../components/Icon";
import PlusBadge from "../components/PlusBadge";
import PostList from "../components/PostList";
import { ProfileSkeleton } from "../components/Skeleton";
import { useBanUser, useUnbanUser } from "../hooks/useModeration";
import { useAvatarAllowance, useProfilePhoto } from "../hooks/useProfilePhoto";
import { useProfile, useToggleFollow, useUpdateProfile, useUserPosts } from "../hooks/useSocial";
import { useRemoveBlock, useSetBlock } from "../hooks/useBlocks";
import { hueFor } from "../lib/hue";
import { useAuth } from "../store/auth";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export default function ProfilePage() {
  const { username = "" } = useParams();
  const { user: me } = useAuth();
  const profile = useProfile(username);
  const posts = useUserPosts(username);
  const follow = useToggleFollow(username);
  const update = useUpdateProfile();
  const ban = useBanUser(username);
  const unban = useUnbanUser(username);
  const setBlock = useSetBlock();
  const removeBlock = useRemoveBlock();
  const allowance = useAvatarAllowance(Boolean(me && profile.data && me.id === profile.data.id));
  const photo = useProfilePhoto(allowance.data);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("7");
  const [banRemovePosts, setBanRemovePosts] = useState(false);

  if (profile.isLoading) return <ProfileSkeleton />;
  if (profile.isError || !profile.data) return <p className="error center">User not found.</p>;

  const p = profile.data;
  const isMe = me?.id === p.id;
  const isAdmin = me?.role === "admin";
  const hue = hueFor(p.username);

  const suspend = (e: FormEvent) => {
    e.preventDefault();
    ban.mutate(
      {
        removePosts: banRemovePosts,
        reason: banReason.trim() || undefined,
        durationDays: banDuration === "permanent" ? null : Number(banDuration),
      },
      { onSuccess: () => setSuspending(false) },
    );
  };

  const startEditing = () => {
    setBio(p.bio);
    setEditing(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ bio }, { onSuccess: () => setEditing(false) });
  };

  const joined = new Date(p.createdAt).toLocaleDateString("en", { month: "long", year: "numeric" });

  return (
    <>
      <section className="card profile" style={{ "--hue": hue.bg } as CSSProperties}>
        <div className="profile-cover" aria-hidden="true" />

        <div className="profile-body">
          <div className="profile-head">
            <div className="profile-avatar">
              {isMe ? (
                <AvatarEditor username={p.username} url={p.avatarUrl} size={96} photo={photo} />
              ) : (
                <Avatar username={p.username} url={p.avatarUrl} size={96} />
              )}
            </div>

            <div className="profile-actions">
              {isMe ? (
                !editing && (
                  <button className="btn btn-outline" onClick={startEditing}>
                    Edit profile
                  </button>
                )
              ) : (
                <>
                  <button
                    className={`btn ${p.followedByMe ? "btn-outline" : ""}`}
                    onClick={() => follow.mutate()}
                    disabled={follow.isPending}
                  >
                    {p.followedByMe ? "Following" : "Follow"}
                  </button>
                  <Link
                    className="btn btn-outline"
                    to={`/messages?to=${encodeURIComponent(p.username)}`}
                  >
                    <Icon name="mail" size={18} /> Message
                  </Link>

                  {p.blockKind ? (
                    <button
                      className="btn btn-outline"
                      disabled={removeBlock.isPending}
                      onClick={() => removeBlock.mutate(p.username)}
                    >
                      {p.blockKind === "block" ? "Unblock" : "Unmute"}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-outline"
                        disabled={setBlock.isPending}
                        onClick={() => setBlock.mutate({ username: p.username, kind: "mute" })}
                      >
                        <Icon name="mute" size={18} /> Mute
                      </button>
                      <button
                        className="btn btn-outline"
                        disabled={setBlock.isPending}
                        onClick={() =>
                          window.confirm(
                            `Block @${p.username}? They won't be able to follow, message or comment on you.`,
                          ) && setBlock.mutate({ username: p.username, kind: "block" })
                        }
                      >
                        <Icon name="block" size={18} /> Block
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="profile-identity">
            <h1 className="profile-name">
              @{p.username} <PlusBadge plus={p.plus} />
            </h1>
            <p className="profile-joined">Joined {joined}</p>
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
                    Done
                  </button>
                  <button className="btn" disabled={update.isPending}>
                    {update.isPending ? "Saving…" : "Save bio"}
                  </button>
                </span>
              </div>
              {update.isError && <p className="error">{update.error.message}</p>}
            </form>
          ) : p.bio ? (
            <p className="profile-bio">{p.bio}</p>
          ) : isMe ? (
            <button type="button" className="profile-bio-empty" onClick={startEditing}>
              Add a bio so people know who you are
            </button>
          ) : null}

          {isMe && (
            <PhotoNotice allowance={allowance.data} photo={photo} hasPhoto={!!p.avatarUrl} />
          )}

          {follow.isError && <p className="error">{follow.error.message}</p>}
          {(setBlock.isError || removeBlock.isError) && (
            <p className="error">{(setBlock.error ?? removeBlock.error)?.message}</p>
          )}
          {p.banned && <p className="suspended">This account is suspended.</p>}
          {isAdmin && !isMe && p.role !== "admin" && !suspending && (
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
                <button
                  className="btn btn-danger"
                  onClick={() => setSuspending(true)}
                  disabled={ban.isPending}
                >
                  Suspend user
                </button>
              )}
            </div>
          )}
          {isAdmin && !isMe && p.role !== "admin" && suspending && !p.banned && (
            <form onSubmit={suspend} className="report-form">
              <label>
                Reason
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Why is this account being suspended?"
                />
              </label>
              <label>
                Duration
                <select value={banDuration} onChange={(e) => setBanDuration(e.target.value)}>
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="permanent">Permanent</option>
                </select>
                <label className="row">
                  <input
                    type="checkbox"
                    onChange={(e) => setBanRemovePosts(e.target.checked)}
                    checked={banRemovePosts}
                  />
                  Also delete all of their posts
                </label>
                <span className="row">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setSuspending(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" disabled={ban.isPending}>
                    {ban.isPending ? "Suspending…" : "Suspend user"}
                  </button>
                </span>
              </label>
            </form>
          )}
          {(ban.isError || unban.isError) && (
            <p className="error">{(ban.error ?? unban.error)?.message}</p>
          )}
        </div>

        <dl className="profile-stats">
          <div>
            <dt>Posts</dt>
            <dd>{compact.format(p.postCount ?? 0)}</dd>
          </div>
          <div>
            <dt>
              {p.connectionsHidden ? (
                "Followers"
              ) : (
                <Link to={`/u/${p.username}/followers`}>Followers</Link>
              )}
            </dt>
            <dd>{compact.format(p.followerCount)}</dd>
          </div>
          <div>
            <dt>
              {p.connectionsHidden ? (
                "Following"
              ) : (
                <Link to={`/u/${p.username}/following`}>Following</Link>
              )}
            </dt>
            <dd>{compact.format(p.followingCount)}</dd>
          </div>
        </dl>

        {isMe && (
          <div className="profile-earnings">
            <EarningsCard />
          </div>
        )}
      </section>

      <h2 className="profile-section">
        <Icon name="image" size={18} /> Posts
      </h2>
      <PostList query={posts} emptyMessage="No posts yet." />
    </>
  );
}

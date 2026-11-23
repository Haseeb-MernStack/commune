import { Link, useParams } from "react-router-dom";
import type { FollowListItemDTO } from "@commune/shared";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import PlusBadge from "../components/PlusBadge";
import { RowsSkeleton } from "../components/Skeleton";
import { useLoadMoreOnVisible } from "../hooks/useInfiniteScroll";
import {
  useFollowList,
  useProfile,
  useToggleFollow,
  type FollowListKind,
} from "../hooks/useSocial";
import { ApiError } from "../lib/api";
import { useAuth } from "../store/auth";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function PersonRow({ person, isMe }: { person: FollowListItemDTO; isMe: boolean }) {
  const toggle = useToggleFollow(person.username);
  const following = person.followedByMe;
  return (
    <li className="person-row">
      <Link to={`/u/${person.username}`} className="person-main">
        <Avatar username={person.username} url={person.avatarUrl} size={48} />
        <span className="person-text">
          <span className="person-name">
            <span className="person-username">@{person.username}</span>
            <PlusBadge plus={person.plus} />
            {person.followsYou && !isMe && <span className="follows-you">Follows you</span>}
          </span>
          {person.bio && <span className="person-bio">{person.bio}</span>}
        </span>
      </Link>
      {!isMe && (
        <button
          className={`btn person-follow ${following ? "btn-outline is-following" : ""}`}
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          aria-pressed={following}
          aria-label={`${following ? "Unfollow" : "Follow"} @${person.username}`}
        >
          <span className="label-default">{following ? "Following" : "Follow"}</span>
          {following && <span className="label-hover">Unfollow</span>}
        </button>
      )}
    </li>
  );
}

/** The people who follow a user, or whom they follow: /u/:username/followers and /following. */
export default function FollowListPage({ kind }: { kind: FollowListKind }) {
  const { username = "" } = useParams();
  const { user: me } = useAuth();
  const profile = useProfile(username);
  const locked = profile.data?.connectionsHidden === true;
  const list = useFollowList(username, kind, !locked);
  const refused = list.error instanceof ApiError && list.error.status === 403;

  const people = list.data?.pages.flatMap((p) => p.items) ?? [];
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = list;
  const sentinel = useLoadMoreOnVisible(
    () => void fetchNextPage(),
    hasNextPage && !isFetchingNextPage && !isError,
  );

  const p = profile.data;
  const own = Boolean(p && me?.id === p.id);
  const name = p?.username ?? username;
  const empty =
    kind === "followers"
      ? own
        ? "You don't have any followers yet. Share your profile to get started."
        : `@${name} doesn't have any followers yet.`
      : own
        ? "You aren't following anyone yet. Explore to find people to follow."
        : `@${name} isn't following anyone yet.`;

  if (profile.isError) return <p className="error center">User not found.</p>;

  return (
    <section className="card follow-page" aria-labelledby="follow-title">
      <header className="follow-head">
        <Link to={`/u/${name}`} className="icon-btn" aria-label={`Back to @${name}`}>
          <Icon name="back" size={20} />
        </Link>
        <div>
          <h1 id="follow-title">@{name}</h1>
          {p && (
            <p className="muted small">
              {compact.format(kind === "followers" ? p.followerCount : p.followingCount)}{" "}
              {kind === "followers"
                ? p.followerCount === 1
                  ? "follower"
                  : "followers"
                : "following"}
            </p>
          )}
        </div>
      </header>

      <nav className="follow-tabs" aria-label="Followers and following">
        <Link
          to={`/u/${name}/followers`}
          className={`tab${kind === "followers" ? " active" : ""}`}
          aria-current={kind === "followers" ? "page" : undefined}
          replace
        >
          Followers
        </Link>
        <Link
          to={`/u/${name}/following`}
          className={`tab${kind === "following" ? " active" : ""}`}
          aria-current={kind === "following" ? "page" : undefined}
          replace
        >
          Following
        </Link>
      </nav>

      {(locked || refused) && (
        <div className="follow-state" role="status">
          <Icon name="lock" size={28} />
          <p>
            <strong>@{name}</strong> keeps their followers and following private.
          </p>
          <Link className="btn btn-outline" to={`/u/${name}`}>
            Back to profile
          </Link>
        </div>
      )}
      {!locked && list.isLoading && <RowsSkeleton count={8} avatar={48} />}
      {list.isError && !refused && (
        <div className="follow-state" role="alert">
          <p className="error">{list.error.message}</p>
          <button className="btn btn-outline" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      )}
      {list.isSuccess && people.length === 0 && <p className="follow-state muted">{empty}</p>}

      {people.length > 0 && (
        <ul className="person-list">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} isMe={person.id === me?.id} />
          ))}
        </ul>
      )}
      {isFetchingNextPage && <RowsSkeleton count={2} avatar={48} />}
      {hasNextPage && <div ref={sentinel} aria-hidden="true" />}
      {hasNextPage && !isFetchingNextPage && !isError && (
        <button className="btn btn-ghost block" onClick={() => void fetchNextPage()}>
          Load more
        </button>
      )}
    </section>
  );
}

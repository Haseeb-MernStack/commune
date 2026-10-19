import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { NotificationDTO } from "@commune/shared";
import { timeAgo } from "../components/PostCard";
import { useMarkAllRead, useNotifications } from "../hooks/useSocial";

const TEXT: Record<NotificationDTO["type"], string> = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "started following you",
};

export default function NotificationsPage() {
  const list = useNotifications();
  const markRead = useMarkAllRead();
  const { mutate } = markRead;

  // Mark everything read once the list has loaded. The page keeps the original
  // "read" flags, so new items stay highlighted while you are looking at them.
  const hasUnread = list.data?.some((n) => !n.read) ?? false;
  useEffect(() => {
    if (hasUnread) mutate();
  }, [hasUnread, mutate]);

  return (
    <>
      <h1 className="page-title">Notifications</h1>
      {list.isLoading && <p className="muted center">Loading…</p>}
      {list.isError && <p className="error center">{list.error.message}</p>}
      {list.isSuccess && list.data.length === 0 && (
        <p className="muted center">Nothing yet. Likes, comments and new followers show up here.</p>
      )}
      {list.data?.map((n) => (
        <Link
          key={n.id}
          to={n.postId ? `/posts/${n.postId}` : `/u/${n.actor.username}`}
          className={`card notification ${n.read ? "" : "unread"}`}
        >
          <span>
            <strong>@{n.actor.username}</strong> {TEXT[n.type]}
          </span>
          <span className="muted">{timeAgo(n.createdAt)}</span>
        </Link>
      ))}
    </>
  );
}

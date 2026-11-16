import { useEffect } from "react";
import { setBadgeCount } from "../lib/badge";
import { useUnreadCount } from "../hooks/useSocial";
import { useUnreadMessages } from "../hooks/useMessages";
import { useAuth } from "../store/auth";

/** Keeps the tab title and app icon in step with unread notifications and conversations. */
export default function BadgeSync() {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const notifications = useUnreadCount(signedIn);
  const messages = useUnreadMessages(signedIn);
  const total = signedIn ? (notifications.data?.count ?? 0) + (messages.data?.count ?? 0) : 0;
  useEffect(() => {
    setBadgeCount(total);
  }, [total]);
  return null;
}

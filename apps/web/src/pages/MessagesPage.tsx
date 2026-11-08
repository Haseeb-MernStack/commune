import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RowsSkeleton, ThreadSkeleton } from "../components/Skeleton";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MESSAGE_MAX_LENGTH, type MessageDTO } from "@commune/shared";
import Avatar from "../components/Avatar";
import PlusBadge from "../components/PlusBadge";
import { timeAgo } from "../components/PostCard";
import {
  PENDING_PREFIX,
  loadOlder,
  useConversations,
  useMarkRead,
  useSendMessage,
  useStartChat,
  useThread,
} from "../hooks/useMessages";
import { joinConversation, noteTyping, stopTyping, useRealtime } from "../lib/realtime";
import { useAuth } from "../store/auth";

/** Text box that sends on Enter (Shift+Enter makes a new line). */
function Composer({
  onSend,
  busy,
  error,
  placeholder,
  onTyping,
  onStopTyping,
}: {
  onSend: (text: string) => Promise<unknown>;
  busy: boolean;
  error?: string | null;
  placeholder: string;
  onTyping?: () => void;
  onStopTyping?: () => void;
}) {
  const [text, setText] = useState("");
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    // Clear at once so the next message can be typed while this one is sent; give the text
    // back if sending fails so nothing is lost.
    setText("");
    onStopTyping?.();
    try {
      await onSend(value);
    } catch {
      setText((current) => current || value);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };
  return (
    <form className="chat-form" onSubmit={(e) => void submit(e)}>
      {error && <p className="error small">{error}</p>}
      <div className="chat-form-row">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) onTyping?.();
          }}
          onKeyDown={onKey}
          placeholder={placeholder}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          aria-label="Message"
        />
        <button className="btn" disabled={busy || !text.trim()}>
          Send
        </button>
      </div>
      {text.length > MESSAGE_MAX_LENGTH - 200 && (
        <span className="muted small">
          {text.length}/{MESSAGE_MAX_LENGTH}
        </span>
      )}
    </form>
  );
}

function Thread({ id }: { id: string }) {
  const { user } = useAuth();
  const thread = useThread(id);
  const send = useSendMessage(id);
  const markRead = useMarkRead(id);
  const [older, setOlder] = useState<MessageDTO[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Live: join this conversation's room for typing and online status.
  useEffect(() => joinConversation(id), [id]);
  const otherId = thread.data?.conversation?.other.id;
  const typing = useRealtime((s) => s.typing[id] === true);
  const online = useRealtime((s) => (otherId ? s.presence[otherId] === true : false));

  // A different conversation: forget the older pages of the previous one.
  useEffect(() => {
    setOlder([]);
    setOlderCursor(undefined);
    stick.current = true;
  }, [id]);

  const latest = thread.data?.items;
  const messages = useMemo(() => {
    const seen = new Set<string>();
    return [...older, ...(latest ?? [])].filter((m) => !seen.has(m.id) && seen.add(m.id));
  }, [older, latest]);

  // Stay at the bottom for new messages, unless the person scrolled up to read.
  useLayoutEffect(() => {
    if (stick.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typing]);

  // A message from the other person arrived while this conversation is open and visible: mark
  // it read (the first load is already marked read by the server).
  const lastMessage = messages[messages.length - 1];
  const lastFromOther =
    Boolean(lastMessage) &&
    lastMessage!.senderId !== user?.id &&
    !lastMessage!.id.startsWith(PENDING_PREFIX);
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (thread.isSuccess && markedRef.current === null) markedRef.current = lastMessage?.id ?? "";
  }, [thread.isSuccess, lastMessage?.id]);
  useEffect(() => {
    const mark = () => {
      if (!lastFromOther || !lastMessage || markedRef.current === lastMessage.id) return;
      if (document.visibilityState !== "visible") return;
      markedRef.current = lastMessage.id;
      markRead.mutate();
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
    // markRead is stable enough for this purpose; the message id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage?.id, lastFromOther]);

  const lastMineId = [...messages].reverse().find((m) => m.senderId === user?.id)?.id;

  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const cursor = olderCursor === undefined ? (thread.data?.nextCursor ?? null) : olderCursor;
  const showOlder = async () => {
    if (!cursor) return;
    setLoadingOlder(true);
    stick.current = false;
    try {
      const page = await loadOlder(id, cursor);
      setOlder((o) => [...page.items, ...o]);
      setOlderCursor(page.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  };

  if (thread.isLoading) return <ThreadSkeleton />;
  if (thread.isError || !thread.data)
    return <p className="error center">Conversation not found.</p>;
  const other = thread.data.conversation?.other;

  return (
    <>
      <div className="chat-head">
        <Link to="/messages" className="icon-btn chat-back" aria-label="Back to conversations">
          ←
        </Link>
        {other && (
          <Link to={`/u/${other.username}`} className="person">
            <Avatar username={other.username} url={other.avatarUrl} size={36} />
            <span className="person-text">
              <strong>
                @{other.username} <PlusBadge plus={other.plus} />
              </strong>
              {typing ? (
                <span className="chat-status typing-label">typing…</span>
              ) : online ? (
                <span className="chat-status">
                  <span className="presence-dot" aria-hidden="true" /> Online
                </span>
              ) : null}
            </span>
          </Link>
        )}
      </div>

      <div className="chat-messages" ref={listRef} onScroll={onScroll}>
        {cursor && (
          <button
            className="link-btn center"
            onClick={() => void showOlder()}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {messages.length === 0 && <p className="muted center">No messages yet. Say hello!</p>}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          const pending = m.id.startsWith(PENDING_PREFIX);
          return (
            <div
              key={m.id}
              className={`bubble-row${mine ? " mine" : ""}${pending ? " pending" : ""}`}
            >
              <div className="bubble">
                <span>{m.text}</span>
                <time
                  className="bubble-time"
                  dateTime={m.createdAt}
                  title={new Date(m.createdAt).toLocaleString()}
                >
                  {pending ? "Sending…" : timeAgo(m.createdAt)}
                </time>
                {mine &&
                  m.id === lastMineId &&
                  !pending &&
                  thread.data?.conversation?.seenByOther && (
                    <span className="bubble-seen">Seen</span>
                  )}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="bubble-row" aria-live="polite">
            <div className="bubble typing-bubble" aria-label="Typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        placeholder="Write a message…"
        busy={false}
        error={send.isError ? send.error.message : null}
        onTyping={() => noteTyping(id)}
        onStopTyping={() => stopTyping(id)}
        onSend={(text) => {
          stick.current = true;
          return send.mutateAsync(text);
        }}
      />
    </>
  );
}

/** First message to someone you have no conversation with yet (from "Message" on a profile). */
function NewChat({ username }: { username: string }) {
  const navigate = useNavigate();
  const start = useStartChat(username);
  return (
    <>
      <div className="chat-head">
        <Link to="/messages" className="icon-btn chat-back" aria-label="Back to conversations">
          ←
        </Link>
        <strong>New message to @{username}</strong>
      </div>
      <div className="chat-messages">
        <p className="muted center">Say hello to @{username}. Be kind; people can report abuse.</p>
      </div>
      <Composer
        placeholder={`Message @${username}…`}
        busy={start.isPending}
        error={start.isError ? start.error.message : null}
        onSend={async (text) => {
          const res = await start.mutateAsync(text);
          navigate(`/messages/${res.conversationId}`, { replace: true });
        }}
      />
    </>
  );
}

export default function MessagesPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const to = params.get("to");
  const { user } = useAuth();
  const navigate = useNavigate();
  const conversations = useConversations();
  const list = conversations.data ?? [];

  // "Message @someone" from a profile: reuse the existing conversation when there is one.
  useEffect(() => {
    if (!to || !conversations.data) return;
    const existing = conversations.data.find(
      (c) => c.other.username.toLowerCase() === to.toLowerCase(),
    );
    if (existing) navigate(`/messages/${existing.id}`, { replace: true });
  }, [to, conversations.data, navigate]);

  const showThread = Boolean(id) || Boolean(to);

  return (
    <div className={`chat${showThread ? " chat-open" : ""}`}>
      <section className="card chat-list" aria-label="Conversations">
        <h1 className="chat-title">Messages</h1>
        {conversations.isLoading && <RowsSkeleton count={6} />}
        {conversations.isError && <p className="error center">Could not load messages.</p>}
        {conversations.data && list.length === 0 && (
          <p className="muted center">
            No conversations yet. Open someone's profile and tap <strong>Message</strong>.
          </p>
        )}
        {list.map((c) => (
          <Link
            key={c.id}
            to={`/messages/${c.id}`}
            className={`convo${c.id === id ? " active" : ""}${c.unread > 0 ? " unread" : ""}`}
          >
            <Avatar username={c.other.username} url={c.other.avatarUrl} size={44} />
            <span className="convo-main">
              <span className="convo-top">
                <strong>
                  @{c.other.username} <PlusBadge plus={c.other.plus} />
                </strong>
                <span className="muted small">{timeAgo(c.lastMessageAt)}</span>
              </span>
              <span className="convo-last muted">
                {c.lastMessage
                  ? (c.lastMessage.senderId === user?.id ? "You: " : "") + c.lastMessage.text
                  : "No messages"}
              </span>
            </span>
            {c.unread > 0 && <span className="pill">{c.unread}</span>}
          </Link>
        ))}
      </section>

      <section className="card chat-thread" aria-label="Conversation">
        {id ? (
          <Thread id={id} key={id} />
        ) : to && conversations.data ? (
          <NewChat username={to} />
        ) : (
          <p className="muted center chat-empty">Select a conversation to start chatting.</p>
        )}
      </section>
    </div>
  );
}

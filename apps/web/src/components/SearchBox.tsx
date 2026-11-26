import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { PostDTO, UserSummaryDTO } from "@commune/shared";
import { api, withQuery } from "../lib/api";

interface Suggestions {
  users: UserSummaryDTO[];
  posts: PostDTO[];
}

type Suggestion =
  | { kind: "user"; id: string; username: string }
  | { kind: "post"; id: string; label: string };

const SUGGEST_DELAY_MS = 250;
const MIN_QUERY_LENGTH = 2;
const LISTBOX_ID = "search-suggestions";

/** Shortens a post to one line for the suggestions list. */
function snippet(content: string) {
  return content.length > 60 ? `${content.slice(0, 60)}…` : content;
}

/** Header search field with live suggestions. Submitting goes to /search?q=... */
export default function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const requestId = useRef(0);

  const users = suggestions?.users ?? [];
  const posts = suggestions?.posts ?? [];
  const items: Suggestion[] = [
    ...users.map((u) => ({ kind: "user" as const, id: u.id, username: u.username })),
    ...posts.map((p) => ({ kind: "post" as const, id: p.id, label: snippet(p.content) })),
  ];
  const total = items.length;

  useEffect(() => {
    const q = text.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions(null);
      setOpen(false);
      setActive(-1);
      return;
    }
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      api<Suggestions>(withQuery("/search/suggest", { q }))
        .then((data) => {
          if (requestId.current !== id) return;
          setSuggestions(data);
          setOpen(true);
          setActive(-1);
        })
        .catch(() => {
          if (requestId.current !== id) return;
          setSuggestions(null);
          setOpen(false);
        });
    }, SUGGEST_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const goTo = (item: Suggestion) => {
    setOpen(false);
    setActive(-1);
    navigate(item.kind === "user" ? `/u/${item.username}` : `/posts/${item.id}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q.length >= MIN_QUERY_LENGTH) {
      setOpen(false);
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (total === 0) return;
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      setActive((a) => Math.min(a + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return;
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      const item = items[active];
      if (item) {
        e.preventDefault();
        goTo(item);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const status = open && total > 0 ? `${total} suggestion${total === 1 ? "" : "s"}` : "";

  return (
    <form
      className="search-box"
      role="search"
      onSubmit={submit}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={active >= 0 ? `search-suggestion-${active}` : undefined}
        aria-autocomplete="list"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search people and posts"
        aria-label="Search people and posts"
        maxLength={50}
      />
      {open && total > 0 && (
        <ul
          className="suggestions"
          id={LISTBOX_ID}
          role="listbox"
          aria-label="Search suggestions"
        >
          {users.map((u, i) => (
            <li
              key={u.id}
              id={`search-suggestion-${i}`}
              className={`suggestion${active === i ? " active" : ""}`}
              role="option"
              aria-selected={active === i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goTo({ kind: "user", id: u.id, username: u.username })}
              onMouseEnter={() => setActive(i)}
            >
              {u.avatarUrl && <img src={u.avatarUrl} alt="" />}
              <span className="suggestion-label">{u.username}</span>
            </li>
          ))}
          {posts.map((p, j) => {
            const i = users.length + j;
            return (
              <li
                key={p.id}
                id={`search-suggestion-${i}`}
                className={`suggestion${active === i ? " active" : ""}`}
                role="option"
                aria-selected={active === i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goTo({ kind: "post", id: p.id, label: snippet(p.content) })}
                onMouseEnter={() => setActive(i)}
              >
                <span className="suggestion-kind">Post</span>
                <span className="suggestion-label">{snippet(p.content)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <span className="sr-only" role="status">
        {status}
      </span>
    </form>
  );
}

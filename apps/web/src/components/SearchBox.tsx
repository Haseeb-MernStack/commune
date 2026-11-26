import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../store/auth";

const STORAGE_KEY = "commune:recent-searches";
const MAX_RECENT = 5;

/** The stored recent searches, newest first. Empty when storage is blocked. */
export function loadRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/**
 * Remember a search, newest first with duplicates merged. Nothing is stored
 * for signed-out visitors, and nothing is stored when storage is blocked.
 */
export function recordRecentSearch(query: string, signedIn: boolean): void {
  if (!signedIn) return;
  try {
    const previous = loadRecentSearches().filter((item) => item !== query);
    const next = [query, ...previous].slice(0, MAX_RECENT);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode, quota, disabled cookies): search still works.
  }
}

function removeRecentSearch(query: string): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(loadRecentSearches().filter((item) => item !== query))
    );
  } catch {
    // The in-memory list is already updated; nothing else to do.
  }
}

function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory list is already cleared; nothing else to do.
  }
}

/** Header search field. Submitting goes to /search?q=... */
export default function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [text, setText] = useState(params.get("q") ?? "");
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const showRecent = open && text.trim() === "" && recent.length > 0;

  const runSearch = (query: string) => {
    const q = query.trim();
    if (q.length < 2) return;
    recordRecentSearch(q, Boolean(user));
    setText(q);
    setOpen(false);
    setActive(-1);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const selected = showRecent && active >= 0 ? recent[active] : undefined;
    if (selected) {
      runSearch(selected);
      return;
    }
    runSearch(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && showRecent) {
      e.preventDefault();
      setActive((current) => (current + 1) % recent.length);
    } else if (e.key === "ArrowUp" && showRecent) {
      e.preventDefault();
      setActive((current) => (current <= 0 ? recent.length - 1 : current - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const removeOne = (query: string) => {
    removeRecentSearch(query);
    setRecent((items) => items.filter((item) => item !== query));
    setActive(-1);
    inputRef.current?.focus();
  };

  const clearAll = () => {
    clearRecentSearches();
    setRecent([]);
    setActive(-1);
    inputRef.current?.focus();
  };

  return (
    <form className="search-box" role="search" onSubmit={submit} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="search"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(-1);
        }}
        onFocus={() => {
          if (user) setRecent(loadRecentSearches());
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search people and posts"
        aria-label="Search people and posts"
        aria-expanded={showRecent}
        aria-controls={showRecent ? "recent-searches" : undefined}
        aria-activedescendant={showRecent && active >= 0 ? `recent-search-${active}` : undefined}
        maxLength={50}
      />
      {showRecent && (
        <div
          id="recent-searches"
          role="listbox"
          aria-label="Recent searches"
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 4,
          }}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {recent.map((item, index) => (
              <li
                key={item}
                id={`recent-search-${index}`}
                role="option"
                aria-selected={index === active}
                style={
                  index === active
                    ? { outline: "2px solid var(--accent)", outlineOffset: -2 }
                    : undefined
                }
              >
                <button type="button" onClick={() => runSearch(item)}>
                  {item}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item} from recent searches`}
                  onClick={() => removeOne(item)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}
    </form>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/** Header search field. Submitting goes to /search?q=... */
export default function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q.length >= 2) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form className="search-box" role="search" onSubmit={submit}>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search people and posts"
        aria-label="Search people and posts"
        maxLength={50}
      />
    </form>
  );
}

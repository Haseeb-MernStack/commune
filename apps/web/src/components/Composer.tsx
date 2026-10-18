import { useState } from "react";
import type { FormEvent } from "react";
import { useCreatePost } from "../hooks/usePosts";

const MAX = 500;

export default function Composer() {
  const [content, setContent] = useState("");
  const create = useCreatePost();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    create.mutate(content, { onSuccess: () => setContent("") });
  };

  return (
    <form className="card composer" onSubmit={submit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's happening in your community?"
        maxLength={MAX}
        rows={3}
      />
      <div className="composer-footer">
        <span className="muted">
          {content.length}/{MAX}
        </span>
        <button className="btn" disabled={create.isPending || !content.trim()}>
          {create.isPending ? "Posting…" : "Post"}
        </button>
      </div>
      {create.isError && <p className="error">{create.error.message}</p>}
    </form>
  );
}

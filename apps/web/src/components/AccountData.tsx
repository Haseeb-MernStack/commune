import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, setAccessToken, writeSessionHint } from "../lib/api";
import { useAuth } from "../store/auth";

/** Download a copy of your data, or delete your account for good. */
export default function AccountData() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");

  const download = useMutation({
    mutationFn: async () => {
      const data = await api<unknown>("/users/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "commune-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });

  const erase = useMutation({
    mutationFn: () =>
      api<void>("/users/me", {
        method: "DELETE",
        body: { confirm: confirm.trim(), ...(password ? { password } : {}) },
      }),
    onSuccess: () => {
      // The server has already ended every session; drop what this browser still holds.
      setAccessToken(null);
      writeSessionHint("0");
      setUser(null);
      navigate("/", { replace: true });
    },
  });

  if (!user) return null;
  const ready = confirm.trim().toLowerCase() === user.username.toLowerCase();

  return (
    <section className="card account-data" aria-label="Your data">
      <h2 className="push-title">Your data</h2>
      <p className="muted">
        Download a copy of everything Commune holds about you: your account details, posts,
        comments, likes, purchases and the messages you sent.
      </p>
      <div className="row">
        <button
          className="btn btn-outline"
          disabled={download.isPending}
          onClick={() => download.mutate()}
        >
          {download.isPending ? "Preparing…" : "Download my data"}
        </button>
      </div>
      {download.isError && (
        <p className="error" role="alert">
          {download.error.message}
        </p>
      )}

      <hr className="account-sep" />

      <h2 className="push-title">Delete account</h2>
      {!open ? (
        <>
          <p className="muted">
            This removes your sign-in and your personal details for good, and cannot be undone.
          </p>
          <div className="row">
            <button className="btn btn-danger" onClick={() => setOpen(true)}>
              Delete my account
            </button>
          </div>
        </>
      ) : (
        <form
          className="account-delete"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !erase.isPending) erase.mutate();
          }}
        >
          <ul className="muted account-notes">
            <li>Your posts, comments, likes, follows and messages are removed.</li>
            <li>
              Paid posts that other people already bought stay available to them, without your name.
            </li>
            <li>An active Commune Plus subscription must be cancelled first.</li>
            <li>Payment records are kept as the law requires.</li>
          </ul>
          <label className="field">
            <span>
              Type your username <strong>{user.username}</strong> to confirm
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={40}
            />
          </label>
          <label className="field">
            <span>Password (leave empty if you only sign in with Google)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={200}
            />
          </label>
          {erase.isError && (
            <p className="error" role="alert">
              {erase.error.message}
            </p>
          )}
          <div className="row">
            <button className="btn btn-danger" type="submit" disabled={!ready || erase.isPending}>
              {erase.isPending ? "Deleting…" : "Delete everything"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setPassword("");
                erase.reset();
              }}
            >
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

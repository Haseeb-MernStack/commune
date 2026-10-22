import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordSchema } from "@commune/shared";
import { api } from "../lib/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match");
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: parsed.data });
      navigate("/login", { replace: true, state: { notice: "Password updated. Log in with it." } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="card auth">
        <h1>Link not valid</h1>
        <p>This reset link is incomplete. Request a new one.</p>
        <Link className="btn block" to="/forgot-password">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)}>
      <h1>Choose a new password</h1>
      <label>
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label>
        Repeat password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <p className="muted">At least 8 characters. You'll be signed out on all devices.</p>
      {error && (
        <p className="error">
          {error} <Link to="/forgot-password">Request a new link</Link>
        </p>
      )}
      <button className="btn block" disabled={busy}>
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
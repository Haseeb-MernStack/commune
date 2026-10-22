import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@commune/shared";
import { api } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: parsed.data });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="card auth">
        <h1>Check your email</h1>
        <p>
          If an account exists for <strong>{email}</strong>, a reset link is on its way. It works
          once and expires in 1 hour.
        </p>
        <p className="muted center">
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)}>
      <h1>Forgot your password?</h1>
      <p className="muted">Enter your email and we'll send you a link to choose a new one.</p>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn block" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <p className="muted center">
        <Link to="/login">Back to log in</Link>
      </p>
    </form>
  );
}

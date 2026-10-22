import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, registerSchema } from "@commune/shared";
import { useAuth } from "../store/auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [fields, setFields] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (key: keyof typeof fields) => (e: ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed =
      mode === "login"
        ? loginSchema.safeParse(fields)
        : registerSchema.safeParse(fields);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(loginSchema.parse(fields));
      else await register(registerSchema.parse(fields));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)}>
      <h1>{mode === "login" ? "Welcome back" : "Join Commune"}</h1>
      {mode === "register" && (
        <label>
          Username
          <input value={fields.username} onChange={set("username")} autoComplete="username" />
        </label>
      )}
      <label>
        Email
        <input type="email" value={fields.email} onChange={set("email")} autoComplete="email" />
      </label>
      <label>
        Password
        <input
          type="password"
          value={fields.password}
          onChange={set("password")}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {notice && mode === "login" && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {mode === "login" && (
        <p className="muted right">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
      )}
      <button className="btn block" disabled={busy}>
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      <p className="muted center">
        {mode === "login" ? (
          <>
            New here? <Link to="/register">Create an account</Link>
          </>
        ) : (
          <>
            Already a member? <Link to="/login">Log in</Link>
          </>
        )}
      </p>
    </form>
  );
}

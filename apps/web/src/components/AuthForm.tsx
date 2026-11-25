import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, registerSchema } from "@commune/shared";
import { getPasswordStrength } from "../lib/password-strength";
import { useAuth } from "../store/auth";
import GoogleButton, { GOOGLE_CLIENT_ID } from "./GoogleButton";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [fields, setFields] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const strength = getPasswordStrength(fields.password);

  if (user) return <Navigate to="/" replace />;

  const set = (key: keyof typeof fields) => (e: ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed =
      mode === "login" ? loginSchema.safeParse(fields) : registerSchema.safeParse(fields);
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

  const google = async (credential: string) => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle(credential);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)}>
      <h1>{mode === "login" ? "Welcome back" : "Join Commune"}</h1>
      {GOOGLE_CLIENT_ID && (
        <>
          <GoogleButton
            onCredential={(c) => void google(c)}
            text={mode === "login" ? "signin_with" : "signup_with"}
          />
          <p className="divider">
            <span>or use your email</span>
          </p>
        </>
      )}
      {mode === "register" && (
        <label>
          Username
          <input
            value={fields.username}
            onChange={(e) => setFields((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            aria-describedby="username-hint"
          />
          <small id="username-hint" className="muted field-hint">
            3 to 24 lowercase letters, numbers or underscores.
          </small>
        </label>
      )}
      <label>
        Email
        <input
          type="email"
          value={fields.email}
          onChange={set("email")}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      <label>
        Password
        <span className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            value={fields.password}
            onChange={set("password")}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-describedby={mode === "register" ? "password-hint" : undefined}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
        {mode === "register" && (
          <small id="password-hint" className="muted field-hint">
            At least 8 characters.
          </small>
      
        )}
      </label>
      {mode === "register" && fields.password.length > 0 && (<div aria-live="polite"><span>Password strength: {strength.label}</span><div role="progressbar" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={5} aria-label="Password strength"><span style={{ width: `${(strength.score / 5) * 100}%` }} /></div>{strength.tips.length > 0 && <small className="muted">{strength.tips.join(" ")}</small>}</div>)}{notice && mode === "login" && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {mode === "login" && (
        <p className="muted right">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
      )}
      <button type="submit" className="btn block" disabled={busy} aria-busy={busy}>
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      {mode === "register" && (
        <p className="muted small center">
          By creating an account you agree to the <Link to="/terms">Terms</Link> and the{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      )}
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

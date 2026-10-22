import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { PublicUser } from "@commune/shared";
import { verifyEmailSchema } from "@commune/shared";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

type Status = "working" | "done" | "failed";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { user, setUser } = useAuth();
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("");
  // The token is single use. React StrictMode runs effects twice in development, so guard it.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const parsed = verifyEmailSchema.safeParse({ token: params.get("token") ?? "" });
    if (!parsed.success) {
      setStatus("failed");
      setMessage("This confirmation link is invalid.");
      return;
    }
    api("/auth/verify-email", { method: "POST", body: parsed.data })
      .then(async () => {
        setStatus("done");
        // Refresh the cached account so the "confirm your email" banner disappears.
        if (user) setUser(await api<PublicUser>("/users/me"));
      })
      .catch((err: unknown) => {
        setStatus("failed");
        setMessage(err instanceof Error ? err.message : "Something went wrong");
      });
  }, [params, user, setUser]);

  return (
    <div className="card auth">
      {status === "working" && <p className="muted center">Confirming your email…</p>}
      {status === "done" && (
        <>
          <h1>Email confirmed</h1>
          <p>Thanks, your address is verified.</p>
          <Link className="btn block" to="/">
            Go to Commune
          </Link>
        </>
      )}
      {status === "failed" && (
        <>
          <h1>Couldn't confirm</h1>
          <p className="error">{message}</p>
          <p className="muted">
            Log in and use the "Resend" button in the banner to get a fresh link.
          </p>
          <Link className="btn block" to="/login">
            Log in
          </Link>
        </>
      )}
    </div>
  );
}

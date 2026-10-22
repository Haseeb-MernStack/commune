import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

/** Shown to logged-in users whose email isn't verified yet. */
export default function VerifyBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!user || user.emailVerified) return null;

  const resend = async () => {
    setState("sending");
    try {
      await api("/auth/resend-verification", { method: "POST" });
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="banner" role="status">
      {state === "sent" ? (
        <span>Link sent. Check your inbox (and spam folder).</span>
      ) : (
        <>
          <span>Confirm your email address to secure your account.</span>
          <button
            className="btn btn-ghost"
            disabled={state === "sending"}
            onClick={() => void resend()}
          >
            {state === "sending" ? "Sending…" : state === "error" ? "Failed, retry" : "Resend link"}
          </button>
        </>
      )}
    </div>
  );
}

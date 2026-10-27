import { useState } from "react";
import type { FormEvent } from "react";
import { contactSchema } from "@commune/shared";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

export default function ContactPage() {
  const { user } = useAuth();
  const [fields, setFields] = useState({ name: user?.username ?? "", email: "", message: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const set = (k: keyof typeof fields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = contactSchema.safeParse(fields);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check your details");
    setState("sending");
    try {
      await api("/contact", { method: "POST", body: parsed.data });
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Could not send your message");
    }
  };

  if (state === "sent") {
    return (
      <section className="card plus-hero">
        <h1>Thank you!</h1>
        <p className="muted">Your message was sent. We'll reply by email as soon as we can.</p>
      </section>
    );
  }

  return (
    <form className="card auth" onSubmit={(e) => void submit(e)} noValidate>
      <h1>Contact us</h1>
      <p className="muted">Questions, feedback or a bug to report? Write to us.</p>
      <label>
        Name
        <input value={fields.name} onChange={set("name")} maxLength={60} autoComplete="name" />
      </label>
      <label>
        Email
        <input type="email" value={fields.email} onChange={set("email")} maxLength={120} autoComplete="email" />
      </label>
      <label>
        Message
        <textarea value={fields.message} onChange={set("message")} rows={6} maxLength={2000} />
      </label>
      {/* Honeypot: hidden from people, tempting for bots. */}
      <input
        className="hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={fields.website}
        onChange={set("website")}
        name="website"
      />
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

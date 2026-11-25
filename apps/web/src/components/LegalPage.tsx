import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { openCookieSettings } from "../lib/consent";

/** Shared layout for the Privacy Policy and the Terms of Service. */
export default function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="card legal">
      <h1>{title}</h1>
      <p className="muted">Last updated {updated}</p>
      <p className="legal-intro">{intro}</p>
      {children}
      <p className="muted small legal-foot">
        <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link> ·{" "}
        <Link to="/contact">Contact us</Link> · <Link to="/help">Help</Link> ·{" "}
        <button type="button" className="link-btn legal-cookie-btn" onClick={openCookieSettings}>
          Cookie settings
        </button>
      </p>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

import { Link, useSearchParams } from "react-router-dom";
import { FREE_POST_LENGTH, PLUS_POST_LENGTH } from "@commune/shared";
import { useBilling, useBillingPortal, useUpgrade } from "../hooks/useBilling";

const FEATURES = [
  ["📊", "Creator insights", "Views, likes, comments and follower growth, with your best posts."],
  ["💸", "Keep more of every sale", "Platform fee on paid posts drops from 20% to 10%."],
  ["✍️", "Longer posts", `Write up to ${PLUS_POST_LENGTH} characters instead of ${FREE_POST_LENGTH}.`],
  ["👥", "More communities", "Create up to 20 communities instead of 5."],
  ["✦", "Plus badge", "A badge next to your name on posts, comments and your profile."],
] as const;

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

export default function PlusPage() {
  const [params] = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const billing = useBilling(welcome);
  const upgrade = useUpgrade();
  const portal = useBillingPortal();
  const b = billing.data;

  return (
    <>
      <section className="card plus-hero">
        <h1>
          Commune Plus <span className="plus-badge">✦</span>
        </h1>
        <p className="muted">Tools for people who create on Commune. Cancel any time.</p>

        {welcome && !b?.plus && (
          <p className="notice">Payment received. Activating Plus, this takes a few seconds…</p>
        )}
        {welcome && b?.plus && <p className="notice">Welcome to Commune Plus! 🎉</p>}

        {b?.plus ? (
          <>
            <p>
              <strong>You're a Plus member.</strong>{" "}
              {b.cancelled && b.plusUntil
                ? `Your plan is cancelled and ends on ${fmt(b.plusUntil)}.`
                : b.plusUntil
                  ? `Your plan renews around ${fmt(b.plusUntil)}.`
                  : null}
            </p>
            <div className="row">
              <Link className="btn" to="/insights">
                Open insights
              </Link>
              {b.status && (
                <button
                  className="btn btn-outline"
                  disabled={portal.isPending}
                  onClick={() => portal.mutate()}
                >
                  {portal.isPending ? "Opening…" : "Manage billing"}
                </button>
              )}
              {b.cancelled && (
                <button className="btn btn-ghost" disabled={upgrade.isPending} onClick={() => upgrade.mutate()}>
                  Resubscribe
                </button>
              )}
            </div>
            {portal.isError && <p className="error">{portal.error.message}</p>}
            {upgrade.isError && <p className="error">{upgrade.error.message}</p>}
          </>
        ) : (
          <>
            <p className="plus-price">{b?.priceLabel ?? ""}</p>
            <button
              className="btn"
              disabled={upgrade.isPending || billing.isLoading || b?.available === false}
              onClick={() => upgrade.mutate()}
            >
              {upgrade.isPending ? "Opening checkout…" : "Upgrade to Plus"}
            </button>
            {b?.available === false && <p className="muted">Commune Plus isn't available yet.</p>}
            {upgrade.isError && <p className="error">{upgrade.error.message}</p>}
            {b?.status && b.status !== "active" && (
              <p className="muted">Your previous subscription has ended.</p>
            )}
          </>
        )}
      </section>

      <section className="plus-features">
        {FEATURES.map(([icon, title, text]) => (
          <div key={title} className="card">
            <span className="plus-icon" aria-hidden>
              {icon}
            </span>
            <strong>{title}</strong>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>
      <p className="muted center">
        Payments are handled securely by Lemon Squeezy. Taxes are added at checkout where required.
      </p>
    </>
  );
}

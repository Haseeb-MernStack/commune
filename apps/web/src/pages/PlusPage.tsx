import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FREE_POST_LENGTH, PLUS_POST_LENGTH, type BillingDTO } from "@commune/shared";
import Icon, { type IconName } from "../components/Icon";
import { CardsSkeleton } from "../components/Skeleton";
import { ACTIVATION_WAIT_MS, useBilling, useBillingPortal, useUpgrade } from "../hooks/useBilling";
import "../styles/plus.css";

const FEATURES: ReadonlyArray<readonly [IconName, string, string]> = [
  [
    "chart",
    "Creator insights",
    "Views, likes, comments and follower growth, with your best posts.",
  ],
  ["coin", "Keep more of every sale", "Platform fee on paid posts drops from 20% to 10%."],
  [
    "pencil",
    "Longer posts",
    `Write up to ${PLUS_POST_LENGTH} characters instead of ${FREE_POST_LENGTH}.`,
  ],
  ["users", "More communities", "Create up to 20 communities instead of 5."],
  ["sparkle", "Plus badge", "A badge next to your name on posts, comments and your profile."],
];

const COMPARE: ReadonlyArray<readonly [string, string, string]> = [
  ["Post length", `${FREE_POST_LENGTH} characters`, `${PLUS_POST_LENGTH} characters`],
  ["Communities you can create", "5", "20"],
  ["Platform fee on paid posts", "20%", "10%"],
  ["Creator insights", "—", "Included"],
  ["Plus badge", "—", "Included"],
];

const FAQ: ReadonlyArray<readonly [string, string]> = [
  [
    "How do I pay?",
    "You pay on a secure checkout page run by Lemon Squeezy, our payment partner. We never see or store your card details.",
  ],
  [
    "When do I get Plus?",
    "Within a few seconds of paying. This page confirms it as soon as the payment arrives.",
  ],
  [
    "Can I cancel?",
    "Yes, any time, from Manage billing. You keep Plus until the end of the period you already paid for.",
  ],
  [
    "What about taxes?",
    "Taxes such as VAT or sales tax are added at checkout where required, and Lemon Squeezy handles them.",
  ],
  [
    "My card was declined or a renewal failed.",
    "Open Manage billing and update your card. Plus stays on for a few days while the payment is retried.",
  ],
];

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" });

/** One short line about where the plan stands. */
function planStatus(b: BillingDTO): { label: string; tone: "ok" | "warn" | "bad"; detail: string } {
  if (b.pastDue) {
    return {
      label: "Payment problem",
      tone: "bad",
      detail: "Your last payment didn't go through. Update your card to keep Plus.",
    };
  }
  if (b.cancelled && b.plusUntil) {
    return { label: "Cancelled", tone: "warn", detail: `You keep Plus until ${fmt(b.plusUntil)}.` };
  }
  const next = b.renewsAt ?? b.plusUntil;
  return {
    label: "Active",
    tone: "ok",
    detail: next ? `Renews on ${fmt(next)}.` : "Your plan is active.",
  };
}

export default function PlusPage() {
  const [params] = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const billing = useBilling(welcome);
  const upgrade = useUpgrade();
  const portal = useBillingPortal();
  const b = billing.data;

  // After paying, give the confirmation a minute before suggesting the person refresh.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  useEffect(() => {
    if (!welcome) return;
    const t = window.setTimeout(() => setWaitedTooLong(true), ACTIVATION_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [welcome]);

  if (billing.isLoading) return <CardsSkeleton count={2} />;
  if (billing.isError || !b) {
    return (
      <p className="error center">
        Could not load your plan.{" "}
        <button className="link-btn" onClick={() => void billing.refetch()}>
          Try again
        </button>
      </p>
    );
  }

  const activating = welcome && !b.plus;
  const hasPlan = b.plus;
  const status = hasPlan ? planStatus(b) : null;

  return (
    <div className="plus-wrap">
      {b.testMode && (
        <div className="plus-banner warn" role="note">
          <Icon name="card" size={18} />
          <span>
            <strong>Test mode.</strong> Payments are simulated and nothing is charged. Use the test
            card 4242 4242 4242 4242 with any future date and any CVC.
          </span>
        </div>
      )}

      {b.pastDue && (
        <div className="plus-banner danger" role="alert">
          <Icon name="flag" size={18} />
          <span>
            <strong>We couldn't take your latest payment.</strong> Update your card now to keep your
            Plus features.
            <span className="row">
              <button className="btn" disabled={portal.isPending} onClick={() => portal.mutate()}>
                {portal.isPending ? "Opening…" : "Update payment method"}
              </button>
            </span>
          </span>
        </div>
      )}

      <section className="card plus-top" aria-live="polite">
        <span className="plus-eyebrow">
          <Icon name="sparkle" size={14} /> Commune Plus
        </span>

        {activating ? (
          <>
            <h1>Almost there</h1>
            <ul className="plus-steps">
              <li className="done">
                <span className="dot">
                  <Icon name="check" size={14} />
                </span>{" "}
                Payment received
              </li>
              <li className={waitedTooLong ? "" : "busy"}>
                <span className="dot" /> Activating Plus on your account
              </li>
              <li>
                <span className="dot" /> Ready to use
              </li>
            </ul>
            {waitedTooLong && (
              <p className="muted">
                This is taking longer than usual. Your payment is safe and Plus will switch on by
                itself. You can refresh this page, or <Link to="/contact">contact us</Link> if it
                still isn't active in a few minutes.
              </p>
            )}
          </>
        ) : hasPlan && status ? (
          <>
            <h1>You're a Plus member{welcome ? " 🎉" : ""}</h1>
            <div className="plus-status">
              <span className={`plus-chip ${status.tone}`}>{status.label}</span>
              <span className="plus-dates">{status.detail}</span>
            </div>
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
                <button
                  className="btn btn-ghost"
                  disabled={upgrade.isPending}
                  onClick={() => upgrade.mutate()}
                >
                  {upgrade.isPending ? "Opening checkout…" : "Resubscribe"}
                </button>
              )}
            </div>
            <p className="muted small">
              Manage billing lets you update your card, download invoices or cancel.
            </p>
            {portal.isError && <p className="error">{portal.error.message}</p>}
            {upgrade.isError && <p className="error">{upgrade.error.message}</p>}
          </>
        ) : (
          <>
            <h1>Create more. Keep more.</h1>
            <p className="muted">Tools for people who create on Commune. Cancel any time.</p>
            <p className="plus-price-big">{b.priceLabel}</p>
            <button
              className="btn plus-cta"
              disabled={upgrade.isPending || b.available === false}
              onClick={() => upgrade.mutate()}
            >
              <Icon name="lock" size={18} />{" "}
              {upgrade.isPending ? "Opening secure checkout…" : "Upgrade to Plus"}
            </button>
            <div className="plus-assure">
              <span>
                <Icon name="lock" size={15} /> Secure checkout
              </span>
              <span>
                <Icon name="check" size={15} /> Cancel any time
              </span>
              <span>
                <Icon name="sparkle" size={15} /> Active within seconds
              </span>
            </div>
            {b.available === false && <p className="muted">Commune Plus isn't available yet.</p>}
            {upgrade.isError && <p className="error">{upgrade.error.message}</p>}
            {b.status && b.status !== "active" && (
              <p className="muted">Your previous subscription has ended.</p>
            )}
          </>
        )}
      </section>

      <section className="plus-features" aria-label="What Plus includes">
        {FEATURES.map(([icon, title, text]) => (
          <div key={title} className="card">
            <span className="plus-icon" aria-hidden>
              <Icon name={icon} size={22} />
            </span>
            <strong>{title}</strong>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="card plus-compare" aria-label="Free compared with Plus">
        <table>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free</th>
              <th scope="col">Plus</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([name, free, plus]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{free}</td>
                <td>{plus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card plus-faq" aria-label="Questions">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <p className="muted center small">
        Payments are handled securely by Lemon Squeezy. Taxes are added at checkout where required.
      </p>
    </div>
  );
}

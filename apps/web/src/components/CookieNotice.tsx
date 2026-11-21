import { useState } from "react";
import { Link } from "react-router-dom";

const KEY = "commune-consent";

type Choice = "all" | "essential";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function stored(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch {
    return null;
  }
}

/** Tells Google's tags what was chosen. index.html applies a saved choice before they load. */
function applyConsent(choice: Choice) {
  const value = choice === "all" ? "granted" : "denied";
  window.gtag?.("consent", "update", {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  });
}

/** One-time notice about analytics and advertising cookies, with a real choice. */
export default function CookieNotice() {
  const [choice, setChoice] = useState<Choice | null>(stored);
  if (choice) return null;

  const pick = (next: Choice) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
    applyConsent(next);
    setChoice(next);
  };

  return (
    <div className="consent-bar" role="dialog" aria-label="Cookies" aria-live="polite">
      <p>
        We use cookies to keep you signed in, and, with your OK, for analytics and ads. See the{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
      <span className="row">
        <button className="btn" onClick={() => pick("all")}>
          Accept all
        </button>
        <button className="btn btn-outline" onClick={() => pick("essential")}>
          Essential only
        </button>
      </span>
    </div>
  );
}

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  closeCookieSettings,
  saveChoice,
  storedChoice,
  useCookieSettingsOpen,
  type Choice,
} from "../lib/consent";

/**
 * Notice about analytics and advertising cookies, with a real choice. Shown once, and again
 * whenever "Cookie settings" reopens it, with the current choice selected.
 */
export default function CookieNotice() {
  const [choice, setChoice] = useState<Choice | null>(storedChoice);
  const reopened = useCookieSettingsOpen();
  const allRef = useRef<HTMLButtonElement>(null);
  const essentialRef = useRef<HTMLButtonElement>(null);

  // Opened from the footer: move focus into the notice so keyboard users land on their choice.
  useEffect(() => {
    if (!reopened) return;
    (choice === "essential" ? essentialRef : allRef).current?.focus();
  }, [reopened, choice]);

  if (choice && !reopened) return null;

  const pick = (next: Choice) => {
    saveChoice(next);
    setChoice(next);
    closeCookieSettings();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (reopened && e.key === "Escape") closeCookieSettings();
  };

  // Only show which option is current when there is one to change.
  const pressed = (option: Choice) => (reopened && choice ? choice === option : undefined);

  return (
    <div
      className="consent-bar"
      role="dialog"
      aria-label="Cookies"
      aria-live="polite"
      onKeyDown={onKeyDown}
    >
      <p>
        We use cookies to keep you signed in, and, with your OK, for analytics and ads. See the{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
      <span className="row">
        <button
          ref={allRef}
          className="btn"
          aria-pressed={pressed("all")}
          onClick={() => pick("all")}
        >
          Accept all
        </button>
        <button
          ref={essentialRef}
          className="btn btn-outline"
          aria-pressed={pressed("essential")}
          onClick={() => pick("essential")}
        >
          Essential only
        </button>
      </span>
    </div>
  );
}

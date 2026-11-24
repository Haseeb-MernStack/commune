import { useSyncExternalStore } from "react";

/**
 * Cookie consent: the stored choice, how it reaches Google's tags, and a tiny store that lets
 * any part of the app (the footer link) reopen the cookie notice.
 */

export const CONSENT_KEY = "commune-consent";

export type Choice = "all" | "essential";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function storedChoice(): Choice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
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

/** Saves a choice and applies it right away, the same way for the first choice and later changes. */
export function saveChoice(choice: Choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* private mode: the choice lasts for this visit only */
  }
  applyConsent(choice);
}

let settingsOpen = false;
const listeners = new Set<() => void>();

function setSettingsOpen(open: boolean) {
  settingsOpen = open;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** True while the notice was reopened from "Cookie settings". */
export const useCookieSettingsOpen = () => useSyncExternalStore(subscribe, () => settingsOpen);

/** Reopens the cookie notice with the current choice selected. */
export const openCookieSettings = () => setSettingsOpen(true);

export const closeCookieSettings = () => setSettingsOpen(false);

import { useEffect, useRef } from "react";

/**
 * One Google AdSense ad unit. Renders nothing unless VITE_ADSENSE_CLIENT (ca-pub-...) and a
 * slot id are set, and never in development, so local work shows no ads and loads no scripts.
 */
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
export const FEED_AD_SLOT = import.meta.env.VITE_ADSENSE_FEED_SLOT as string | undefined;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptAdded = false;

function loadAdSense(client: string) {
  if (scriptAdded) return;
  scriptAdded = true;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

export default function AdSlot({ slot }: { slot: string | undefined }) {
  const pushed = useRef(false);
  const enabled = import.meta.env.PROD && Boolean(CLIENT) && Boolean(slot);

  useEffect(() => {
    if (!enabled || !CLIENT || pushed.current) return;
    pushed.current = true;
    loadAdSense(CLIENT);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* an ad blocker or a failed script must never break the page */
    }
  }, [enabled]);

  if (!enabled) return null;
  return (
    <aside className="ad-slot" aria-label="Advertisement">
      <span className="ad-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

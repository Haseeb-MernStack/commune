import { useState } from "react";
import { applyUpdate, promptInstall, useOnline, usePwa } from "../lib/pwa";

const DISMISS_KEY = "commune-install-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Offline notice, "new version" prompt and "install app" prompt, stacked at the bottom. */
export default function PwaBanner() {
  const { updateReady, canInstall } = usePwa();
  const online = useOnline();
  const [installHidden, setInstallHidden] = useState(wasDismissed);

  const dismissInstall = () => {
    setInstallHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: just hide it for this visit */
    }
  };

  const showInstall = canInstall && !installHidden;
  if (online && !updateReady && !showInstall) return null;

  return (
    <div className="pwa-bars" role="region" aria-label="App status">
      {!online && (
        <div className="pwa-bar pwa-offline" role="status">
          You're offline. Some things won't load until you're back.
        </div>
      )}
      {updateReady && (
        <div className="pwa-bar" role="status">
          <span>A new version of Commune is ready.</span>
          <button className="btn" onClick={applyUpdate}>
            Reload
          </button>
        </div>
      )}
      {showInstall && (
        <div className="pwa-bar">
          <span>Install Commune for quick access from your home screen.</span>
          <span className="row">
            <button className="btn" onClick={() => void promptInstall()}>
              Install
            </button>
            <button className="btn btn-ghost" onClick={dismissInstall} aria-label="Dismiss">
              Not now
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

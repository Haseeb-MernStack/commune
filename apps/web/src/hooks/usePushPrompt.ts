import { useEffect, useState } from "react";
import { useDeviceSubscription, useEnablePush, usePushStatus } from "./usePush";
import { needsInstallForPush, pushPermission, pushSupported } from "../lib/push";
import { useAuth } from "../store/auth";

const DISMISS_KEY = "commune-push-dismissed";
/** Wait a little, so the question comes after the person has had a look around. */
const SHOW_AFTER_MS = 15_000;

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Offers to turn on notifications once, to signed-in people on devices that can receive them.
 * Browsers only allow the permission question after a tap, so this is a banner with a button.
 */
export function usePushPrompt() {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const status = usePushStatus(signedIn);
  const device = useDeviceSubscription();
  const enable = useEnablePush(status.data?.publicKey ?? null);
  const [hidden, setHidden] = useState(wasDismissed);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    const timer = window.setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [signedIn]);

  const show =
    signedIn &&
    ready &&
    !hidden &&
    status.data?.enabled === true &&
    pushSupported() &&
    !needsInstallForPush() &&
    pushPermission() === "default" &&
    device.data === false;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: just hide it for this visit */
    }
  };

  return {
    show,
    dismiss,
    turnOn: () => enable.mutate(undefined, { onSuccess: () => setHidden(true) }),
    pending: enable.isPending,
    error: enable.isError ? enable.error.message : null,
  };
}

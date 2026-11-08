import type { PushSubscribeInput } from "@commune/shared";
import { api } from "./api";

/**
 * Browser side of Web Push: ask permission, subscribe through the service worker, and tell the
 * server. Nothing is requested until the person presses the button.
 */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhones only allow notifications for apps added to the Home Screen. */
export function needsInstallForPush(): boolean {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export const pushPermission = (): NotificationPermission =>
  typeof Notification === "undefined" ? "denied" : Notification.permission;

function keyToBytes(base64Url: string): Uint8Array {
  const padded = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** `ready` never resolves when no service worker is registered (for example in development). */
function readyOrFail(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error("The app is not ready for notifications yet. Reload and try again.")),
        6000,
      ),
    ),
  ]);
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await readyOrFail();
  // Notification handling lives in the service worker, so make sure the newest one is active.
  try {
    await reg.update();
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  } catch {
    /* offline: use what is installed */
  }
  return reg;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Asks permission (if needed), subscribes this device and registers it with the server. */
export async function enablePush(publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed");
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(publicKey) as BufferSource,
    }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
    throw new Error("This browser did not return a push subscription");
  const body: PushSubscribeInput = {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
  await api<void>("/push/subscribe", { method: "POST", body });
}

/** Stops notifications on this device (browser and server). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api<void>("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(
    () => undefined,
  );
  await sub.unsubscribe().catch(() => undefined);
}

/** Called on sign-out so a shared device stops receiving the previous person's notifications. */
export async function releasePushOnLogout(): Promise<void> {
  try {
    await Promise.race([disablePush(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch {
    /* signing out must never fail because of this */
  }
}

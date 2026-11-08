import { useSyncExternalStore } from "react";

/**
 * Commune's notification sounds.
 *
 * Two short, soft glass-bell chimes (about 20 KB each): one for a new message, one for a like,
 * comment or follower. They are played with the Web Audio API so they start instantly.
 *
 * Browsers only allow sound after the person has touched the page once, so the audio engine wakes up
 * on the first tap or key press. Until then a chime is skipped silently (never an error).
 */
export type SoundKind = "message" | "notification";

interface SoundPrefs {
  enabled: boolean;
  /** 0 to 1 */
  volume: number;
}

const STORAGE_KEY = "commune.sound";
const FILES: Record<SoundKind, string> = {
  message: "/sounds/message.mp3",
  notification: "/sounds/notification.mp3",
};
/** A burst of messages should sound like one chime, not a machine gun. */
const MIN_GAP_MS = 900;

// ---- Preferences (kept on this device only) ----
const DEFAULTS: SoundPrefs = { enabled: true, volume: 0.7 };

function load(): SoundPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS.enabled,
      volume:
        typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULTS.volume,
    };
  } catch {
    return DEFAULTS;
  }
}

let prefs: SoundPrefs = load();
const listeners = new Set<() => void>();

export function setSoundPrefs(patch: Partial<SoundPrefs>) {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode or blocked storage: the choice just lasts until the page closes.
  }
  listeners.forEach((l) => l());
}

export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => prefs,
    () => prefs,
  );
}

// ---- Audio engine ----
type AudioContextCtor = typeof AudioContext;
const Ctor: AudioContextCtor | undefined =
  typeof window === "undefined"
    ? undefined
    : (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);

let ctx: AudioContext | null = null;
const buffers = new Map<SoundKind, AudioBuffer>();
const loading = new Map<SoundKind, Promise<AudioBuffer | null>>();
let lastPlayed = 0;

function load1(kind: SoundKind): Promise<AudioBuffer | null> {
  const existing = loading.get(kind);
  if (existing) return existing;
  const p = (async () => {
    if (!ctx) return null;
    try {
      const res = await fetch(FILES[kind]);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      // The callback form works on older Safari as well.
      const buf = await new Promise<AudioBuffer>((resolve, reject) =>
        ctx!.decodeAudioData(data, resolve, reject),
      );
      buffers.set(kind, buf);
      return buf;
    } catch {
      loading.delete(kind); // try again next time
      return null;
    }
  })();
  loading.set(kind, p);
  return p;
}

/** Wakes the audio engine. Must run from a tap, click or key press. Safe to call many times. */
export function unlockAudio() {
  if (!Ctor) return;
  try {
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    void load1("message");
    void load1("notification");
  } catch {
    // No audio device: stay silent.
  }
}

let armed = false;
/** Call once at start-up: the first interaction anywhere on the page unlocks sound. */
export function armSoundUnlock() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const handler = () => {
    unlockAudio();
    if (ctx && ctx.state === "running")
      events.forEach((e) => window.removeEventListener(e, handler));
  };
  events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
}

/**
 * Plays a chime. Returns false when it was skipped (muted, too soon after the last one,
 * or the browser has not allowed sound yet). `force` is for the preview buttons.
 */
export function playSound(kind: SoundKind, opts: { force?: boolean } = {}): boolean {
  if (!ctx || ctx.state !== "running") return false;
  if (!opts.force && !prefs.enabled) return false;
  const now = performance.now();
  if (!opts.force && now - lastPlayed < MIN_GAP_MS) return false;

  const buffer = buffers.get(kind);
  if (!buffer) {
    void load1(kind); // ready for next time
    return false;
  }
  lastPlayed = now;
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = prefs.volume * prefs.volume; // squared so the slider feels even to the ear
    source.connect(gain).connect(ctx.destination);
    source.start();
    return true;
  } catch {
    return false;
  }
}

/** True when the person is already looking at this conversation, so a chime would just be noise. */
export function isViewingConversation(conversationId: string): boolean {
  return (
    document.visibilityState === "visible" &&
    window.location.pathname === `/messages/${conversationId}`
  );
}

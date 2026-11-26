export function tap(): void {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    navigator.vibrate?.(10);
  } catch {
    // Haptics are best-effort: ignore browsers without vibration support.
  }
}

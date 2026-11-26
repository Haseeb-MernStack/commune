import { useEffect, useRef } from "react";
import { SHORTCUTS } from "../lib/shortcuts";

/**
 * A modal dialog listing the global keyboard shortcuts, opened with "?".
 * Uses the native <dialog>, which traps focus while open. Focus returns to
 * the element that opened the dialog when it closes.
 */
export default function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        returnFocusRef.current = document.activeElement as HTMLElement | null;
        dialog.showModal();
      }
    } else {
      if (dialog.open) dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts-dialog"
      aria-label="Keyboard shortcuts"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2>Keyboard shortcuts</h2>
      <ul className="shortcuts-list">
        {SHORTCUTS.map((s) => (
          <li key={s.key}>
            <kbd>{s.key}</kbd>
            <span>{s.description}</span>
          </li>
        ))}
      </ul>
      <p className="muted">Shortcuts do not work while you are typing.</p>
      <button type="button" className="btn" onClick={onClose}>
        Close
      </button>
    </dialog>
  );
}

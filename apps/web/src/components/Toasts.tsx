import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { dismissToast, useToasts, type Toast } from "../lib/toast";

/** Banners for new messages while Commune is open, so nothing is missed on another page. */
export default function Toasts() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastBanner key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastBanner({ toast: t }: { toast: Toast }) {
  const actionRef = useRef<HTMLButtonElement>(null);

  // An action such as Undo often follows a control that just disappeared (a deleted post's
  // menu). Keyboard focus would fall back to the page, so put it on the action instead.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) actionRef.current?.focus();
  }, []);

  const text = (
    <>
      <strong>{t.title}</strong>
      <span>{t.body}</span>
    </>
  );

  return (
    <div className="toast">
      {t.to ? (
        <Link to={t.to} className="toast-main" onClick={() => dismissToast(t.id)}>
          {text}
        </Link>
      ) : (
        <div className="toast-main">{text}</div>
      )}
      {t.action && (
        <button
          ref={actionRef}
          className="toast-action"
          type="button"
          onClick={() => {
            t.action?.onClick();
            dismissToast(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button
        className="toast-close"
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissToast(t.id)}
      >
        ×
      </button>
    </div>
  );
}

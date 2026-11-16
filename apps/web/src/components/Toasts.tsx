import { Link } from "react-router-dom";
import { dismissToast, useToasts } from "../lib/toast";

/** Banners for new messages while Commune is open, so nothing is missed on another page. */
export default function Toasts() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <Link to={t.to} className="toast-main" onClick={() => dismissToast(t.id)}>
            <strong>{t.title}</strong>
            <span>{t.body}</span>
          </Link>
          <button
            className="toast-close"
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

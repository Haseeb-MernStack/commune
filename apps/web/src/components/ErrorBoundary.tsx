import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "../lib/report";

const RELOAD_KEY = "commune_chunk_reload";

/** A page file that no longer exists: the site was updated while this tab was open. */
function isStaleChunk(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message,
  );
}

interface State {
  failed: boolean;
}

/**
 * Last line of defence: if rendering throws, show a friendly screen instead of a blank page,
 * and report the error. After a new deployment, an open tab can ask for page files that are
 * gone; one automatic reload fixes that without the visitor noticing.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (isStaleChunk(error)) {
      try {
        if (sessionStorage.getItem(RELOAD_KEY) !== "1") {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return;
        }
      } catch {
        /* storage blocked: fall through to the message */
      }
    }
    reportError("react", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        className="card center"
        role="alert"
        style={{ margin: "20vh auto 0", maxWidth: 420, padding: 24 }}
      >
        <h1 className="page-title">Something went wrong</h1>
        <p className="muted">The problem has been reported. Reloading usually fixes it.</p>
        <button className="btn btn-primary" onClick={() => window.location.assign("/")}>
          Reload Commune
        </button>
      </div>
    );
  }
}

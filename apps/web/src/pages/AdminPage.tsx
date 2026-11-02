import { useState } from "react";
import { Navigate } from "react-router-dom";
import type { ReportDTO, ReportStatus } from "@commune/shared";
import Avatar from "../components/Avatar";
import { timeAgo } from "../components/PostCard";
import { REASON_LABELS } from "../components/ReportForm";
import { useErrorEvents, useResolveError } from "../hooks/useErrors";
import { useAdminReports, useDismissReport, useResolveReport } from "../hooks/useModeration";
import { assetUrl } from "../lib/api";
import { useAuth } from "../store/auth";

const TABS: Array<{ id: ReportStatus; label: string }> = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "dismissed", label: "Dismissed" },
];

function ReportItem({ report, actionable }: { report: ReportDTO; actionable: boolean }) {
  const dismiss = useDismissReport();
  const resolve = useResolveReport();
  const busy = dismiss.isPending || resolve.isPending;
  const error = dismiss.error ?? resolve.error;

  const removePost = () => {
    if (window.confirm("Remove this post?")) {
      resolve.mutate({ id: report.id, action: "remove_post" });
    }
  };
  const removeAndSuspend = () => {
    if (report.post && window.confirm(`Remove this post and suspend @${report.post.author.username}?`)) {
      resolve.mutate({ id: report.id, action: "remove_post_and_ban" });
    }
  };

  return (
    <article className="card report">
      <div className="report-head">
        <strong>{REASON_LABELS[report.reason]}</strong>
        <span className="muted">
          reported by @{report.reporter.username} · {timeAgo(report.createdAt)}
        </span>
      </div>
      {report.details && <p className="report-details">“{report.details}”</p>}

      {report.post ? (
        <div className="report-post post-head">
          <Avatar username={report.post.author.username} url={report.post.author.avatarUrl} size={32} />
          <div className="post-main">
            <strong>@{report.post.author.username}</strong>
            {report.post.content && <p className="post-body">{report.post.content}</p>}
            {report.post.imageUrl && (
              <img
                className="post-image"
                src={assetUrl(report.post.imageUrl)}
                alt="Reported attachment"
                loading="lazy"
              />
            )}
          </div>
        </div>
      ) : (
        <p className="muted">This post has already been deleted.</p>
      )}

      {actionable && (
        <div className="row report-actions">
          <button className="btn btn-outline" onClick={() => dismiss.mutate(report.id)} disabled={busy}>
            Dismiss
          </button>
          {report.post && (
            <>
              <button className="btn btn-outline" onClick={removePost} disabled={busy}>
                Remove post
              </button>
              <button className="btn btn-danger" onClick={removeAndSuspend} disabled={busy}>
                Remove post and suspend author
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="error">{error.message}</p>}
    </article>
  );
}

function ErrorsPanel() {
  const errors = useErrorEvents(true);
  const resolve = useResolveError();
  const items = errors.data ?? [];
  return (
    <>
      {errors.isLoading && <p className="muted center">Loading…</p>}
      {errors.isError && <p className="error center">{errors.error.message}</p>}
      {errors.isSuccess && items.length === 0 && (
        <p className="muted center">No open errors. Everything looks healthy.</p>
      )}
      {items.map((e) => (
        <article key={e.id} className="card report">
          <div className="report-head">
            <strong>{e.message}</strong>
            <span className="muted">
              {e.source === "web" ? "Browser" : "API"} · {e.count}× · last {timeAgo(e.lastSeen)}
            </span>
          </div>
          <p className="muted">{e.route}</p>
          {e.stack && (
            <details>
              <summary className="muted">Stack trace</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, overflowWrap: "anywhere" }}>{e.stack}</pre>
            </details>
          )}
          <div className="row report-actions">
            <button className="btn btn-outline" onClick={() => resolve.mutate(e.id)} disabled={resolve.isPending}>
              Mark as fixed
            </button>
          </div>
        </article>
      ))}
    </>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"reports" | "errors">("reports");
  const [status, setStatus] = useState<ReportStatus>("open");
  const reports = useAdminReports(status);

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  const items = reports.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <h1 className="page-title">Admin</h1>
      <div className="tabs" role="tablist" aria-label="Admin sections">
        <button role="tab" aria-selected={view === "reports"} className={`tab ${view === "reports" ? "active" : ""}`} onClick={() => setView("reports")}>
          Moderation
        </button>
        <button role="tab" aria-selected={view === "errors"} className={`tab ${view === "errors" ? "active" : ""}`} onClick={() => setView("errors")}>
          Errors
        </button>
      </div>
      {view === "errors" ? (
        <ErrorsPanel />
      ) : (
      <>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === status}
            className={`tab ${t.id === status ? "active" : ""}`}
            onClick={() => setStatus(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reports.isLoading && <p className="muted center">Loading…</p>}
      {reports.isError && <p className="error center">{reports.error.message}</p>}
      {reports.isSuccess && items.length === 0 && (
        <p className="muted center">
          {status === "open" ? "No open reports. Nice and quiet." : "Nothing here yet."}
        </p>
      )}
      {items.map((r) => (
        <ReportItem key={r.id} report={r} actionable={status === "open"} />
      ))}
      {reports.hasNextPage && (
        <button
          className="btn btn-ghost block"
          onClick={() => void reports.fetchNextPage()}
          disabled={reports.isFetchingNextPage}
        >
          {reports.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
      </>
      )}
    </>
  );
}

import type { CSSProperties, ReactNode } from "react";

/**
 * Loading placeholders that copy the shape of the real content (like Instagram's grey blocks),
 * so the screen is laid out immediately and nothing jumps when the data arrives.
 * Styles live in styles/skeleton.css.
 */

/** One grey block. Give it a width and height, or use the shape classes. */
export function Sk({
  w,
  h,
  circle,
  className = "",
  style,
}: {
  w?: number | string;
  h?: number | string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`sk${circle ? " sk-circle" : ""} ${className}`}
      style={{ width: w, height: h, ...style }}
      aria-hidden="true"
    />
  );
}

/** Wraps a group of placeholders so screen readers hear one short "loading" message. */
function Busy({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sk-sr">{label}</span>
      {children}
    </div>
  );
}

// Different widths so a list does not look like a copied block.
const BODY_WIDTHS = [["92%", "78%", "55%"], ["85%", "40%"], ["96%", "88%", "64%"], ["70%"]];

export function PostSkeleton({ index = 0 }: { index?: number }) {
  const lines = BODY_WIDTHS[index % BODY_WIDTHS.length]!;
  const withImage = index % 3 === 1;
  return (
    <div className="card post post-head sk-post" aria-hidden="true">
      <Sk circle w={40} h={40} />
      <div className="post-main">
        <div className="sk-row">
          <Sk className="sk-line tall" w={110} />
          <Sk className="sk-line" w={48} />
        </div>
        <div className="sk-stack">
          {lines.map((w, i) => (
            <Sk key={i} className="sk-line" w={w} />
          ))}
        </div>
        {withImage && <Sk className="sk-image" />}
        <div className="sk-actions">
          <Sk className="sk-pill" />
          <Sk className="sk-pill" />
        </div>
      </div>
    </div>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Busy label="Loading posts">
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={i} index={i} />
      ))}
    </Busy>
  );
}

/** The "What's happening" panel. */
export function NewsPanelSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Busy label="Loading news">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-news" aria-hidden="true">
          <Sk className="sk-line" w="40%" />
          <Sk className="sk-line tall" w="95%" />
          <Sk className="sk-line tall" w={i % 2 ? "60%" : "75%"} />
        </div>
      ))}
    </Busy>
  );
}

/** Cards on the full news page. */
export function NewsCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Busy label="Loading headlines">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card sk-news-card" aria-hidden="true">
          <Sk className="sk-line" w="30%" />
          <Sk className="sk-line tall" w="92%" />
          <Sk className="sk-line tall" w={i % 2 ? "55%" : "70%"} />
        </div>
      ))}
    </Busy>
  );
}

/** Rows with an avatar and two lines: conversations, notifications, communities. */
export function RowsSkeleton({
  count = 6,
  avatar = 44,
  card = false,
}: {
  count?: number;
  avatar?: number;
  card?: boolean;
}) {
  return (
    <Busy label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`sk-convo${card ? " card" : ""}`} aria-hidden="true">
          <Sk circle w={avatar} h={avatar} />
          <div className="sk-stack">
            <Sk className="sk-line tall" w={`${40 + ((i * 17) % 35)}%`} />
            <Sk className="sk-line" w={`${55 + ((i * 11) % 35)}%`} />
          </div>
        </div>
      ))}
    </Busy>
  );
}

export function ThreadSkeleton() {
  const sides = [false, false, true, false, true, true, false];
  return (
    <Busy label="Loading conversation">
      <div className="sk-thread" aria-hidden="true">
        {sides.map((me, i) => (
          <Sk key={i} className={`sk-bubble${me ? " me" : ""}`} w={`${30 + ((i * 13) % 35)}%`} />
        ))}
      </div>
    </Busy>
  );
}

export function ProfileSkeleton() {
  return (
    <Busy label="Loading profile">
      <div className="card sk-profile" aria-hidden="true">
        <div className="sk-row">
          <Sk circle w={84} h={84} />
          <div className="sk-stack" style={{ flex: 1 }}>
            <Sk className="sk-line tall" w="45%" />
            <Sk className="sk-line" w="30%" />
            <Sk className="sk-line" w="80%" />
          </div>
        </div>
        <div className="sk-actions">
          <Sk className="sk-pill" w={90} />
          <Sk className="sk-pill" w={90} />
        </div>
      </div>
      <PostSkeleton index={0} />
      <PostSkeleton index={2} />
    </Busy>
  );
}

/** Generic stack of cards, for pages without a special shape. */
export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Busy label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card sk-news-card" aria-hidden="true">
          <Sk className="sk-line tall" w="50%" />
          <Sk className="sk-line" w="90%" />
          <Sk className="sk-line" w="65%" />
        </div>
      ))}
    </Busy>
  );
}

/** Shown while the app signs you in and while a page's code downloads. */
export function PageSkeleton() {
  return (
    <div className="route-loading">
      <Sk className="sk-page-title" />
      <PostListSkeleton count={3} />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/**
 * Shows one picture full screen on top of the app, so people never leave the page to look at it.
 * Built on the native <dialog>, which keeps focus inside, sits above everything and closes with
 * Escape. A click on the dark area or the close button also closes it; a click on the picture
 * zooms it in and out. Focus goes back to whatever opened it.
 */
export default function ImageViewer({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    // Older browsers and test environments may not have showModal().
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="viewer"
      aria-label={alt}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button type="button" className="viewer-close" aria-label="Close image" onClick={onClose}>
        <Icon name="close" size={22} />
      </button>
      {/* eslint-disable-next-line jsx-a11y-x/click-events-have-key-events, jsx-a11y-x/no-static-element-interactions -- Clicking the dark area is a pointer shortcut; keyboard users close with Escape or the Close button. */}
      <div
        className="viewer-stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* eslint-disable-next-line jsx-a11y-x/click-events-have-key-events, jsx-a11y-x/no-noninteractive-element-interactions -- Click to zoom is a pointer extra; the picture is fully visible without it. */}
        <img
          className={`viewer-img${zoomed ? " is-zoomed" : ""}`}
          src={src}
          alt={alt}
          draggable={false}
          onClick={() => setZoomed((z) => !z)}
        />
      </div>
      {caption && <p className="viewer-caption">{caption}</p>}
    </dialog>,
    document.body,
  );
}

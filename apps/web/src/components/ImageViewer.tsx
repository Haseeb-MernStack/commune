import { useEffect, useRef } from "react";

/**
 * A full-screen viewer for a post image.
 * Uses the native <dialog>, which traps focus while open. Focus returns to
 * the element that opened the dialog when it closes. The page behind it does
 * not scroll while it is open, and the image is lazy so nothing extra is
 * fetched until the viewer opens.
 */
export default function ImageViewer({
  src,
  alt,
  open,
  onClose,
}: {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const overflowRef = useRef("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        returnFocusRef.current = document.activeElement as HTMLElement | null;
        overflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog.showModal();
      }
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflowRef.current;
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
    return () => {
      document.body.style.overflow = overflowRef.current;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="image-viewer"
      aria-label={alt}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <button
        type="button"
        className="image-viewer-close"
        onClick={onClose}
        aria-label="Close image viewer"
      >
        ×
      </button>
      <img
        className="image-viewer-image"
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    </dialog>
  );
}

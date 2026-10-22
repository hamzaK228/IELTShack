"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function QuestionImage({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <figure className="q-figure">
      <button
        type="button"
        className="q-image-btn"
        onClick={() => setOpen(true)}
        aria-label="Open question image at full size"
      >
        <img className="q-image" src={src} alt="Question diagram or table" loading="lazy" />
      </button>
      <span className="q-image-hint">Tap the image to view it full size</span>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Question image, full size"
          onClick={() => setOpen(false)}
        >
          <button
            ref={closeRef}
            type="button"
            className="image-lightbox-close"
            onClick={() => setOpen(false)}
            aria-label="Close full-size image"
          >
            ✕ Close
          </button>
          <img src={src} alt="Question diagram or table, full size" onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body,
      )}
    </figure>
  );
}

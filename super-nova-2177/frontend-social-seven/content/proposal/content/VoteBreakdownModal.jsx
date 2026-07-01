"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import useBodyScrollLock from "@/utils/useBodyScrollLock";

/* Safety net only: the real close signal is the exit animation's animationend
   (desktop 160ms, mobile sheet 180ms, ~0ms under reduced motion). */
const EXIT_FALLBACK_MS = 260;

/* Shared shell for the vote breakdown popups (post cards + the home System
   Decision), so both get the exact same close behavior: × button, Escape,
   drag-safe backdrop click, swipe-down sheet on phones, animated exit.
   Parent owns `closing`; the modal reports back through onRequestClose
   (user asked to close) and onClosed (exit animation finished — unmount now). */
export default function VoteBreakdownModal({
  closing,
  onRequestClose,
  onClosed,
  title = "Vote breakdown",
  ariaLabel = "Vote breakdown",
  children,
}) {
  const cardRef = useRef(null);
  const backdropPressRef = useRef(false);
  const sheetDragRef = useRef({ startY: 0, delta: 0, dragging: false });
  const dragFrameRef = useRef(0);

  useBodyScrollLock(true);

  /* Escape closes the breakdown */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onRequestClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onRequestClose]);

  /* Move focus into the dialog when it opens */
  useEffect(() => {
    cardRef.current?.focus?.();
  }, []);

  /* Unmount even if animationend never fires (e.g. the tab was backgrounded
     mid-close and the browser skipped the animation). */
  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(onClosed, EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [closing, onClosed]);

  useEffect(
    () => () => {
      if (dragFrameRef.current) cancelAnimationFrame(dragFrameRef.current);
    },
    []
  );

  /* While closing, the only animation that can finish on the card itself is
     the exit one (switching classes cancels the entry animation), so this is
     the moment the popup is fully off screen. */
  const handleCardAnimationEnd = (e) => {
    if (closing && e.target === e.currentTarget) onClosed();
  };

  const applyDragTransform = () => {
    dragFrameRef.current = 0;
    const card = cardRef.current;
    const state = sheetDragRef.current;
    if (!card || !state.dragging) return;
    card.style.transform = state.delta > 0 ? `translateY(${state.delta}px)` : "";
  };

  /* Drag the sheet header down to dismiss (mobile bottom-sheet gesture). */
  const handleSheetTouchStart = (e) => {
    sheetDragRef.current = { startY: e.touches[0].clientY, delta: 0, dragging: true };
    if (cardRef.current) cardRef.current.style.transition = "";
  };

  const handleSheetTouchMove = (e) => {
    const state = sheetDragRef.current;
    if (!state.dragging) return;
    state.delta = Math.max(0, e.touches[0].clientY - state.startY);
    /* Coalesce to one style write per frame — touchmove can outpace the
       display refresh on 120Hz phones. */
    if (!dragFrameRef.current) {
      dragFrameRef.current = requestAnimationFrame(applyDragTransform);
    }
  };

  const handleSheetTouchEnd = () => {
    const state = sheetDragRef.current;
    if (!state.dragging) return;
    state.dragging = false;
    if (dragFrameRef.current) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
    }
    const card = cardRef.current;
    if (state.delta > 72) {
      /* Leave the inline transform in place: the exit animation only declares
         a "to" frame, so it animates smoothly from the dragged position. */
      onRequestClose();
    } else if (card) {
      card.style.transition = "transform 0.18s ease";
      card.style.transform = "";
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`vote-modal-backdrop ${closing ? "vote-modal-backdrop-closing" : ""}`}
      onPointerDown={(e) => {
        backdropPressRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        /* Only close when the press started AND ended on the backdrop,
           so drag-selecting text inside the card never dismisses it. */
        if (e.target === e.currentTarget && backdropPressRef.current) onRequestClose();
      }}
    >
      <div
        ref={cardRef}
        data-vote-modal
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="vote-modal-card outline-none"
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={handleCardAnimationEnd}
      >
        <div
          className="vote-modal-chrome"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
        >
          <span className="vote-modal-grab" aria-hidden="true" />
          <div className="vote-modal-chrome-row">
            <span className="vote-modal-title">{title}</span>
            <button
              type="button"
              onClick={onRequestClose}
              aria-label="Close vote breakdown"
              className="vote-info-close"
            >
              <IoClose />
            </button>
          </div>
        </div>
        <div className="vote-modal-scroll">{children}</div>
      </div>
    </div>,
    document.body
  );
}

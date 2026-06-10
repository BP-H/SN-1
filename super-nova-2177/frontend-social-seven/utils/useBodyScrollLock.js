"use client";

import { useEffect } from "react";

let lockCount = 0;

/* Freezes page scroll while a full-screen modal is open so the feed cannot
   keep scrolling behind the backdrop. Reference-counted so overlapping
   modals (e.g. a lightbox opened from a modal) release the lock correctly. */
export default function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const { body } = document;
    lockCount += 1;
    if (lockCount === 1) {
      root.style.overflow = "hidden";
      body.style.overflow = "hidden";
    }
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        root.style.overflow = "";
        body.style.overflow = "";
      }
    };
  }, [active]);
}

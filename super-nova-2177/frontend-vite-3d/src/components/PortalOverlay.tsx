// src/components/PortalOverlay.tsx  (fires the white-burst using your CSS)
import React, { useEffect, useRef, useState } from "react";
import bus from "../lib/bus";

export default function PortalOverlay() {
  const ref = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);
  const [on, setOn] = useState(false);

  // Attach animationend listener once to reliably hide when CSS animation finishes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleAnimEnd = () => {
      setOn(false);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };

    el.addEventListener("animationend", handleAnimEnd);
    return () => {
      el.removeEventListener("animationend", handleAnimEnd);
    };
  }, []);

  // Bus listener: position, trigger animation, and provide a timeout fallback.
  useEffect(() => {
    const off = bus.on("orb:portal", ({ x, y }: { x: number; y: number }) => {
      const el = ref.current;
      if (!el) return;

      // position the burst
      el.style.setProperty("--px", `${x}px`);
      el.style.setProperty("--py", `${y}px`);

      // restart the animation: remove class if present, force reflow, then set state to add class
      el.classList.remove("on");
      // force reflow to allow animation to restart
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      void el.offsetWidth;
      setOn(true);

      // clear any previous fallback timer
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      // fallback: hide after a short timeout in case animationend doesn't fire
      timer.current = window.setTimeout(() => {
        setOn(false);
        timer.current = null;
      }, 900);
    });

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      off();
    };
  }, []);

  return <div ref={ref} className={`portal-overlay${on ? " on" : ""}`} />;
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import PostComposer from "./PostComposer";
import "./neon-ribbon.css";

export default function NeonRibbonComposer() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);

  const openComposer = useCallback(() => setOpen(true), []);
  const closeComposer = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  // global shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open && e.key === "/") {
        const t = e.target as HTMLElement;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setOpen(true);
      } else if (open && e.key === "Escape") {
        e.preventDefault();
        closeComposer();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeComposer]);

  // autofocus textarea on open
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const ta = containerRef.current?.querySelector<HTMLTextAreaElement>("textarea");
      ta?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // focus trap when open
  useEffect(() => {
    if (!open) return;
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const nodes = containerRef.current?.querySelectorAll<HTMLElement>(
        'a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    const node = containerRef.current;
    node?.addEventListener("keydown", trap);
    return () => node?.removeEventListener("keydown", trap);
  }, [open]);

  const handleToggleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openComposer();
      }
    },
    [openComposer]
  );

  return (
    <div ref={containerRef} className={`neon-ribbon${open ? " expanded" : ""}`}>
      {!open && (
        <div
          ref={toggleRef}
          className="neon-ribbon__toggle"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label="Compose new post"
          onClick={openComposer}
          onKeyDown={handleToggleKey}
        >
          <span aria-hidden="true" className="neon-ribbon__line" />
        </div>
      )}
      {open && <PostComposer />}
    </div>
  );
}

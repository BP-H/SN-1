import React, { useEffect, useRef, useState } from "react";
import usePointer from "../hooks/usePointer";
import bus from "../lib/bus";
import RadialMenu from "./RadialMenu";
import { HOLD_MS, MOVE_TOLERANCE, SNAP_PADDING } from "./orbConstants";

type Props = {
  onAnalyzeImage: (imgUrl: string) => void;
};

type Mode = "idle" | "menu" | "analyze";

export default function PortalOrb({ onAnalyzeImage }: Props) {
  const orbRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const originRef = useRef({ x: 0, y: 0 });
  const [mode, setMode] = useState<Mode>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("orb-pos");
      return saved ? JSON.parse(saved) : { x: 16, y: 16 };
    }
    return { x: 16, y: 16 };
  });
  const [dragging, setDragging] = useState(false);
  const analyzeOverlay = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orb-pos", JSON.stringify(pos));
    }
    if (orbRef.current) {
      orbRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    }
  }, [pos]);

  function withinSafe(x: number, y: number) {
    if (typeof window === "undefined") {
      return { x, y };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = 64;
    return {
      x: Math.min(Math.max(x, SNAP_PADDING), w - size - SNAP_PADDING),
      y: Math.min(Math.max(y, SNAP_PADDING), h - size - SNAP_PADDING),
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    startRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    originRef.current = { x: e.clientX, y: e.clientY };

    // long-press => analyze mode
    holdRef.current = window.setTimeout(() => {
      startAnalyze();
    }, HOLD_MS);
  }

  function handlePointerMove(ev: PointerEvent) {
    if (!dragging) return;
    const next = withinSafe(
      ev.clientX - startRef.current.x,
      ev.clientY - startRef.current.y
    );
    setPos(next);
    if (
      holdRef.current &&
      Math.hypot(
        ev.clientX - originRef.current.x,
        ev.clientY - originRef.current.y
      ) > MOVE_TOLERANCE
    ) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
    if (mode === "analyze" && analyzeOverlay.current) {
      analyzeOverlay.current.style.setProperty("--x", `${ev.clientX}px`);
      analyzeOverlay.current.style.setProperty("--y", `${ev.clientY}px`);
    }
  }

  function finishInteraction(ev: PointerEvent, canceled = false) {
    setDragging(false);
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
    try {
      orbRef.current?.releasePointerCapture(ev.pointerId);
    } catch {}

    if (mode === "analyze") {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as
        | HTMLElement
        | null;
      const url = el?.closest("[data-asset]")?.getAttribute("data-asset");
      if (url) onAnalyzeImage(url);
      setMode("idle");
      setMenuOpen(false);
      teardownAnalyzeOverlay();
    } else if (canceled) {
      setMode("idle");
      setMenuOpen(false);
      orbRef.current?.classList.remove("grow");
      teardownAnalyzeOverlay();
    }
  }

  function handlePointerUp(ev: PointerEvent) {
    const isTap =
      Math.hypot(ev.clientX - originRef.current.x, ev.clientY - originRef.current.y) <=
      MOVE_TOLERANCE;
    if (mode !== "analyze" && isTap) {
      const next = !menuOpen;
      setMenuOpen(next);
      setMode(next ? "menu" : "idle");
      orbRef.current?.classList.toggle("grow", next);
    }
    finishInteraction(ev);
  }

  function handlePointerCancel(e: React.PointerEvent) {
    finishInteraction(e.nativeEvent, true);
  }

  function startAnalyze() {
    setMode("analyze");
    setMenuOpen(false);
    orbRef.current?.classList.remove("grow");
    setupAnalyzeOverlay();
  }

  function setupAnalyzeOverlay() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "55";
    overlay.style.background =
      "radial-gradient(600px 600px at var(--x,50%) var(--y,50%), rgba(10,132,255,.18), transparent 60%)";
    overlay.style.transition = "background .2s ease";
    overlay.className = "analyze-overlay";
    analyzeOverlay.current = overlay;
    document.body.appendChild(overlay);
  }

  function teardownAnalyzeOverlay() {
    analyzeOverlay.current?.remove();
    analyzeOverlay.current = null;
  }

  const actions: {
    id: string;
    icon: React.ReactNode;
    label: string;
    action: () => void;
  }[] = [
    {
      id: "compose",
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <path
            d="M4 20h16M4 4h12l4 4v8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
      label: "Compose",
      action: () => {
        setMode("idle");
        setMenuOpen(false);
        orbRef.current?.classList.remove("grow");
        bus.emit("compose");
      },
    },
    {
      id: "recenter",
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
      label: "Recenter",
      action: () => {
        setMode("idle");
        setMenuOpen(false);
        setPos({ x: 12, y: 12 });
        orbRef.current?.classList.remove("grow");
        orbRef.current?.classList.add("vortex");
        window.setTimeout(() => orbRef.current?.classList.remove("vortex"), 900);
      },
    },
    {
      id: "close",
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <path
            d="M5 5l14 14M19 5L5 19"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
      label: "Close",
      action: () => {
        setMode("idle");
        setMenuOpen(false);
        orbRef.current?.classList.remove("grow");
      },
    },
  ];

  function handleOrbKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const next = !menuOpen;
      setMenuOpen(next);
      setMode(next ? "menu" : "idle");
      orbRef.current?.classList.toggle("grow", next);
    } else if (e.key === "Escape") {
      setMenuOpen(false);
      setMode("idle");
      orbRef.current?.classList.remove("grow");
    }
  }

  // radial menu handled by shared component

  usePointer(dragging, {
    onMove: handlePointerMove,
    onUp: handlePointerUp,
  });

  return (
    <>
      <div
        ref={orbRef}
        className={`portal-orb ${menuOpen ? "open" : ""} ${
          mode === "analyze" ? "analyzing" : ""
        }`}
        onPointerDown={handlePointerDown}
        onPointerCancel={handlePointerCancel}
        role="button"
        tabIndex={0}
        aria-label="AI Portal"
        title="AI Portal"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onKeyDown={handleOrbKeyDown}
      >
        {/* inner glow */}
        <div className="orb-core" />
        {/* radial menu */}
        {menuOpen && (
          <RadialMenu
            center={{ x: pos.x + 32, y: pos.y + 32 }}
            items={actions}
            onClose={() => {
              setMenuOpen(false);
              setMode("idle");
              orbRef.current?.classList.remove("grow");
            }}
          />
        )}
      </div>

      {/* styles */}
      <style>{`
        .portal-orb{
          position:fixed;left:0;top:0;z-index:56;
          width:64px;height:64px;transform:translate(${pos.x}px,${pos.y}px);
          transition:transform .18s ease;
          contain:layout paint;
        }
        .orb-core{
          width:100%;height:100%;
          background:
            radial-gradient(60% 60% at 40% 35%, rgba(255,255,255,.9), rgba(255,255,255,.2) 65%, transparent 70%),
            radial-gradient(80% 80% at 70% 70%, rgba(10,132,255,.8), rgba(10,132,255,.2) 70%, transparent 72%),
            radial-gradient(120% 120% at 50% 50%, rgba(10,132,255,.2), transparent 60%);
          border:1px solid var(--stroke-2);
          box-shadow:0 0 0 1px rgba(255,255,255,.06) inset, 0 8px 40px rgba(10,132,255,.35);
        }

        .portal-orb.open .orb-core{
          animation:pulse 1.6s ease infinite;
        }
        @keyframes pulse{
          0%{box-shadow:0 0 0 1px rgba(255,255,255,.06) inset,0 8px 40px rgba(10,132,255,.35)}
          50%{box-shadow:0 0 0 1px rgba(255,255,255,.1) inset,0 8px 60px rgba(10,132,255,.55)}
          100%{box-shadow:0 0 0 1px rgba(255,255,255,.06) inset,0 8px 40px rgba(10,132,255,.35)}
        }

        .portal-orb.grow .orb-core{ transform:scale(1.08) }

        .portal-orb.vortex .orb-core{
          background:
            conic-gradient(from 0deg, rgba(10,132,255,.8), rgba(155,134,255,.8), rgba(110,168,254,.8), rgba(10,132,255,.8));
          animation:spin 0.9s ease forwards;
        }
        @keyframes spin{ to{ filter:hue-rotate(90deg) saturate(1.3) } }

        .analyzing .orb-core{ box-shadow:0 0 0 1px rgba(255,255,255,.08) inset, 0 10px 70px rgba(10,132,255,.7) }
      `}</style>
    </>
  );
}

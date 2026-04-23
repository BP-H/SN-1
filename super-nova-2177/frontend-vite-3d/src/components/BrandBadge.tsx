import { useRef, useState } from "react";
import bus from "../lib/bus";

export default function BrandBadge({ onEnterUniverse }: { onEnterUniverse: () => void }) {
  const [open, setOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);

  // Long-press (touch/mouse) opens the brand menu
  const startPress = () => {
    stopPress();
    pressTimer.current = window.setTimeout(() => setOpen(true), 500);
  };
  const stopPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <>
      <div className="brand-wrap">
        <button
          className="brand-dot"
          aria-label="Toggle sidebar"
          title="Click: toggle sidebar • Right-click/long-press: brand menu"
          onClick={() => bus.emit("sidebar:toggle")}
          onContextMenu={(e) => { e.preventDefault(); setOpen(o => !o); }}
          onPointerDown={startPress}
          onPointerUp={stopPress}
          onPointerCancel={stopPress}
          onKeyDown={(e) => {
            const k = e.key.toLowerCase();
            if (k === "enter" || k === " ") bus.emit("sidebar:toggle");
            if (k === "m") setOpen(o => !o);
          }}
        >
          {/* Inline SVG logo (no external asset required) */}
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <defs>
              <radialGradient id="sn-grad" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#9aa8ff" />
                <stop offset="60%" stopColor="#6a73ff" />
                <stop offset="100%" stopColor="#0b0d12" />
              </radialGradient>
            </defs>
            <circle cx="20" cy="20" r="18" fill="url(#sn-grad)" stroke="rgba(255,255,255,.2)" />
            <circle cx="20" cy="20" r="6" fill="rgba(255,255,255,.85)" />
          </svg>
        </button>
        <div className="brand-label">superNova2177</div>
      </div>

      {open && (
        <div className="brand-menu">
          <button onClick={() => bus.emit("chat:add", { role:"system", text:"Command palette (stub)" })}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M5 12h14M5 7h10M5 17h7" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            <span>Command</span>
          </button>
          <button onClick={() => bus.emit("chat:add", { role:"assistant", text:"Remix current image (stub)" })}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M7 7h10v4H7zm0 6h6v4H7z" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            <span>Remix</span>
          </button>
          <button onClick={onEnterUniverse}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            <span>Enter Universe</span>
          </button>
        </div>
      )}
    </>
  );
}

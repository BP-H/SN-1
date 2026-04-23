// src/components/AssistantOrb.tsx
import React, { useEffect, useRef, useState } from "react";
import bus from "../lib/bus";
import { logError } from "../lib/logger";
import { askLLM } from "../lib/assistant";
import type { AssistantMessage, Post } from "../types";
import RadialMenu from "./RadialMenu";
import { HOLD_MS } from "./orbConstants";
import "./orbs.css";

/**
 * Assistant Orb — circular quick menu + 60fps drag + voice.
 * - Tap = show radial menu (Chat top / React / Comment / Remix / Profile)
 * - Hold = push-to-talk; Double-click = toggle mic
 * - Drag (cross threshold) also starts mic; drop over post links context
 * - Petal drawers for React/Comment/Remix; Chat panel on side
 */

interface SpeechRecognitionResult {
  [index: number]: { transcript: string };
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: SpeechRecognitionErrorEvent) => void;
  onresult?: (e: SpeechRecognitionEvent) => void;
  start?: () => void;
  stop?: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface WindowWithSpeechRecognition extends Window {
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  SpeechRecognition?: SpeechRecognitionConstructor;
}

const ORB_SIZE = 76;
const ORB_MARGIN = 12;
const DRAG_THRESHOLD = 5;
const PANEL_WIDTH = 360;
const STORAGE_KEY = "assistantOrbPos.v6";

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const uuid = () => {
  try {
    return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  } catch {
    return Math.random().toString(36).slice(2);
  }
};

const EMOJI_LIST: string[] = [
  "🤗","😂","🤣","😅","🙂","😉","😍","😎","🥳","🤯","😡","😱","🤔","🤭","🙄","🥺","🤪","🤫","🤤","😴",
  "👻","🤖","👽","😈","👋","👍","👎","👏","🙏","👀","💪","🫶","💅","🔥","✨","⚡","💥","❤️","🫠","🫡",
  "💙","💜","🖤","🤍","❤️‍🔥","❤️‍🩹","💯","💬","🗯️","🎉","🎊","🎁","🏆","🎮","🚀","✈️","🚗","🏠","🫨","🗿",
  "📱","💡","🎵","📢","📚","📈","✅","❌","❗","❓","‼️","⚠️","🌀","🎬","🍕","🍔","🍎","🍺","⚙️","🧩"
];

function getClosestPostId(el: Element | null): string | null {
  return el?.closest?.("[data-post-id]")?.getAttribute?.("data-post-id") ?? null;
}

function getPostText(p: Post | null): string {
  if (!p) return "";
  try {
    const el = document.querySelector(`[data-post-id="${p.id}"]`);
    return el?.textContent?.trim().slice(0, 2000) || "";
  } catch {
    return "";
  }
}

export default function AssistantOrb() {
  // committed position
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { x: number; y: number };
        return {
          x: clamp(saved.x, ORB_MARGIN, window.innerWidth - ORB_SIZE - ORB_MARGIN),
          y: clamp(saved.y, ORB_MARGIN, window.innerHeight - ORB_SIZE - ORB_MARGIN),
        };
      }
    } catch {}
    return {
      x: window.innerWidth - ORB_SIZE - ORB_MARGIN,
      y: window.innerHeight - ORB_SIZE - ORB_MARGIN,
    };
  });
  const posRef = useRef<{ x: number; y: number }>({ ...pos });

  // UI
  const [open, setOpen] = useState(false);       // chat panel
  const [mic, setMic] = useState(false);
  const [toast, setToast] = useState("");
  const [interim, setInterim] = useState("");
  const [msgs, setMsgs] = useState<AssistantMessage[]>([]);
  const [ctxPost, setCtxPost] = useState<Post | null>(null);
  const [ctxPostText, setCtxPostText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // radial
  const [petal, setPetal] = useState<null | "comment" | "remix" | "share">(null);
  const [hovering, setHovering] = useState(false);
  const [pressing, setPressing] = useState(false);

  // gestures
  const movedRef = useRef(false);
  const pressRef = useRef<{ id: number; dx: number; dy: number; sx: number; sy: number } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const lastPtrRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const preventTapRef   = useRef(false);
  const hoverIdRef = useRef<string | null>(null);

  // DOM refs
  const orbRef = useRef<HTMLButtonElement | null>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const interimRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const msgListRef = useRef<HTMLDivElement | null>(null);

  // feed context
  useEffect(() => {
    const onCtx = (p: { post: Post }) => {
      setCtxPost(p.post);
      setCtxPostText(getPostText(p.post));
    };
    const offHover = bus.on?.("feed:hover", onCtx);
    const offSelect = bus.on?.("feed:select", onCtx);
    return () => {
      offHover?.();
      offSelect?.();
    };
  }, []);

  // speech
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const restartRef = useRef(false);
  function ensureRec(): SpeechRecognitionLike | null {
    if (recRef.current) return recRef.current;
    const C: SpeechRecognitionConstructor | null =
      (typeof window !== "undefined" &&
        ((window as WindowWithSpeechRecognition).webkitSpeechRecognition ||
          (window as WindowWithSpeechRecognition).SpeechRecognition)) ||
      null;
    if (!C) { setToast("Voice not supported"); return null; }
    let rec: SpeechRecognitionLike;
    try {
      rec = new C();
    } catch (err) {
      logError(err);
      setToast("Mic error");
      return null;
    }
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onstart = () => { setMic(true); setToast("Listening…"); };
    rec.onend = () => {
      setMic(false);
      setToast("");
      if (restartRef.current) {
        try {
          rec.start?.();
        } catch (err) {
          logError(err);
        }
      }
    };
    rec.onerror = (_e: SpeechRecognitionErrorEvent) => { setMic(false); setToast("Mic error"); };
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let temp = ""; const finals: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]; const t = r[0]?.transcript || "";
        r.isFinal ? finals.push(t) : (temp += t);
      }
      setInterim(temp.trim());
      const final = finals.join(" ").trim();
      if (final) { setInterim(""); handleCommand(final); }
    };
    recRef.current = rec;
    return rec;
  }
  function startListening() {
    if (mic) return;
    const r = ensureRec(); if (!r) return;
    restartRef.current = true;
    try { r.start?.(); } catch (err) { logError(err); setMic(false); setToast("Mic error"); }
  }
  function stopListening() {
    restartRef.current = false;
    try { recRef.current?.stop?.(); } catch (err) { logError(err); }
    setMic(false);
    setInterim("");
  }

  // commands
  const push = (m: AssistantMessage) => setMsgs(s => [...s, m]);

  async function handleCommand(text: string) {
    const post = ctxPost || null;
    push({ id: uuid(), role: "user", text, ts: Date.now(), postId: post?.id ?? null });

    const T = text.trim();
    const lower = T.toLowerCase();

    if (lower.startsWith("/react")) {
      const emoji = T.replace("/react", "").trim() || "❤️";
      if (post) {
        bus.emit?.("post:react", { id: post.id, emoji });
        push({ id: uuid(), role: "assistant", text: `✨ Reacted ${emoji} on ${post.id}`, ts: Date.now(), postId: post.id });
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Drag the orb over a post first.", ts: Date.now() });
      }
      return;
    }
    if (lower.startsWith("/comment ")) {
      const body = T.slice(9).trim();
      if (post) {
        bus.emit?.("post:comment", { id: post.id, body });
        push({ id: uuid(), role: "assistant", text: `💬 Commented: ${body}`, ts: Date.now(), postId: post.id });
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Drag onto a post to comment.", ts: Date.now() });
      }
      return;
    }
    if (lower.startsWith("/world")) {
      bus.emit?.("orb:portal", { x: posRef.current.x, y: posRef.current.y });
      push({ id: uuid(), role: "assistant", text: "🌀 Entering world…", ts: Date.now(), postId: post?.id ?? null });
      return;
    }
    if (lower.startsWith("/remix")) {
      if (post) {
        bus.emit?.("post:remix", { id: post.id });
        push({ id: uuid(), role: "assistant", text: `🎬 Remixing ${post.id}`, ts: Date.now(), postId: post.id });
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Drag onto a post to remix.", ts: Date.now() });
      }
      return;
    }

    // Ask the model with optional post context (id, title, and visible text)
    const resp = await askLLM(
      T,
      post
        ? {
            postId: post.id as unknown as string | number,
            title: (post as any)?.title,
            text: ctxPostText || getPostText(post),
          }
        : null
    );
    push(resp);
  }

  // ✅ missing function (caused your build error)
  function handleEmojiClick(emoji: string) {
    if (!ctxPost) { setToast("Hover a post first"); return; }
    bus.emit?.("post:react", { id: ctxPost.id, emoji });
    setToast(`Reacted ${emoji}`);
    window.setTimeout(() => setToast(""), 900);
  }

  // hover highlight
  function setHover(id: string | null) {
    if (hoverIdRef.current) {
      document
        .querySelector(`[data-post-id="${hoverIdRef.current}"]`)
        ?.classList.remove("pc-target");
      hoverIdRef.current = null;
    }
    if (id) {
      document
        .querySelector(`[data-post-id="${id}"]`)
        ?.classList.add("pc-target");
      hoverIdRef.current = id;
    }
  }

  // move & anchors
  function applyTransform(x: number, y: number) {
    const el = orbRef.current; if (!el) return;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
  }

  function updateAnchors() {
    if (typeof window === "undefined") return;
    const { x, y } = posRef.current;

    const panelEl = panelRef.current;
    const measuredPanelW = panelEl?.offsetWidth || PANEL_WIDTH;
    const spaceRight = window.innerWidth - (x + ORB_SIZE + 8);
    const placeRightPanel = spaceRight >= (measuredPanelW + 16);
    const placeRightToast = spaceRight >= 200;

    if (toastRef.current) {
      const s = toastRef.current.style;
      s.position = "fixed";
      s.top = `${y + ORB_SIZE / 2}px`;
      s.left = placeRightToast ? `${x + ORB_SIZE + 8}px` : `${x - 8}px`;
      s.transform = placeRightToast ? "translateY(-50%)" : "translate(-100%, -50%)";
    }

    if (interimRef.current) {
      const s = interimRef.current.style;
      s.position = "fixed";
      s.top = `${Math.max(ORB_MARGIN, y - 30)}px`;
      s.left = placeRightToast ? `${x + ORB_SIZE + 8}px` : `${x - 8}px`;
      s.transform = placeRightToast ? "none" : "translateX(-100%)";
    }

    if (panelEl && open) {
      const s = panelEl.style;
      const panelH = panelEl.offsetHeight || 260;
      const top = clamp(
        y - 180,
        ORB_MARGIN,
        Math.max(ORB_MARGIN, window.innerHeight - panelH - ORB_MARGIN)
      );
      s.position = "fixed";
      s.top = `${top}px`;
      if (placeRightPanel) {
        s.left = `${x + ORB_SIZE + 8}px`;
        s.right = "";
        s.transform = "none";
      } else {
        s.left = `${x - 8}px`;
        s.right = "";
        s.transform = "translateX(-100%)";
      }
    }
  }

  // pointer handlers
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = orbRef.current; if (!el) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    const dx = e.clientX - posRef.current.x;
    const dy = e.clientY - posRef.current.y;
    pressRef.current = { id: e.pointerId, dx, dy, sx: e.clientX, sy: e.clientY };
    movedRef.current = false;
    preventTapRef.current = false;
    setDragging(true);
    setMenuOpen(false);
    setPressing(true);

    el.style.pointerEvents = "none";

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      startListening();
    }, HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pressRef.current) return;
    lastPtrRef.current = { x: e.clientX, y: e.clientY };
    if (moveRafRef.current != null) return;

    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const cur = lastPtrRef.current; if (!cur) return;

      const { dx, dy, sx, sy } = pressRef.current!;
      const nx = clamp(cur.x - dx, ORB_MARGIN, Math.max(ORB_MARGIN, window.innerWidth - ORB_SIZE - ORB_MARGIN));
      const ny = clamp(cur.y - dy, ORB_MARGIN, Math.max(ORB_MARGIN, window.innerHeight - ORB_SIZE - ORB_MARGIN));
      const dist = Math.hypot(cur.x - sx, cur.y - sy);
      if (holdTimerRef.current && dist > DRAG_THRESHOLD) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (!movedRef.current && dist > DRAG_THRESHOLD) {
        movedRef.current = true;
        preventTapRef.current = true;
        // Start listening once drag threshold is crossed
        if (!mic) { suppressClickRef.current = true; startListening(); }
      }

      posRef.current = { x: nx, y: ny };
      applyTransform(nx, ny);
      updateAnchors();

      const under = document.elementFromPoint(cur.x, cur.y);
      const id = getClosestPostId(under);
      if (id !== hoverIdRef.current) {
        setHover(id);
        if (id) bus.emit?.("feed:select-id", { id });
      }
    });
  };

  function finishGesture(clientX: number, clientY: number) {
    pressRef.current = null;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (moveRafRef.current != null) { cancelAnimationFrame(moveRafRef.current); moveRafRef.current = null; }

    setPos({ ...posRef.current });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current)); } catch {}
    updateAnchors();

    if (mic && (suppressClickRef.current || movedRef.current)) {
      stopListening();
      if (movedRef.current) {
        const under = document.elementFromPoint(clientX, clientY);
        const id = getClosestPostId(under);
        if (id) {
          bus.emit?.("post:focus", { id });
          setToast(`🎯 linked to ${id}`);
          window.setTimeout(() => setToast(""), 1100);
        }
      }
    }

    setHover(null);
    setDragging(false);
    setPressing(false);
    movedRef.current = false;
    suppressClickRef.current = false;

    const el = orbRef.current; if (el) el.style.pointerEvents = "auto";
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    lastPtrRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    finishGesture(e.clientX, e.clientY);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    lastPtrRef.current = null;
    finishGesture(e.clientX, e.clientY);
  };

  const onLostPointerCapture = () => {
    const last = lastPtrRef.current;
    lastPtrRef.current = null;
    const fallback = { x: posRef.current.x + ORB_SIZE / 2, y: posRef.current.y + ORB_SIZE / 2 };
    finishGesture(last?.x ?? fallback.x, last?.y ?? fallback.y);
  };

  const onClick = () => {
    if (suppressClickRef.current || preventTapRef.current) {
      suppressClickRef.current = false;
      preventTapRef.current = false;
      return;
    }
    setMenuOpen(v => !v);
    requestAnimationFrame(updateAnchors);
  };

  // double‑click toggles mic
  const onDoubleClick = () => {
    if (mic) stopListening(); else startListening();
  };

  // lifecycle
  useEffect(() => { applyTransform(pos.x, pos.y); posRef.current = { ...pos }; updateAnchors(); }, []);
  useEffect(() => { updateAnchors(); }, [open, toast, interim, menuOpen, dragging]);
  useEffect(() => { if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight; }, [msgs]);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const menuEl = document.querySelector('[role="menu"]');
      if (orbRef.current?.contains(e.target as Node)) return;
      if (menuEl?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (typeof window === "undefined") return;
      const nx = clamp(posRef.current.x, ORB_MARGIN, window.innerWidth - ORB_SIZE - ORB_MARGIN);
      const ny = clamp(posRef.current.y, ORB_MARGIN, window.innerHeight - ORB_SIZE - ORB_MARGIN);
      posRef.current = { x: nx, y: ny };
      setPos({ x: nx, y: ny });
      applyTransform(nx, ny);
      updateAnchors();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMenuOpen(false);
        setPetal(null);
        stopListening();
        orbRef.current?.focus();
      }
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    return () => {
      try { recRef.current?.stop?.(); } catch {}
      recRef.current = null; restartRef.current = false;
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
      setHover(null);
    };
  }, []);

  // styles
  const keyframes = `
    @keyframes panelIn { from { opacity: 0; transform: scale(.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  `;
  const orbStyle: React.CSSProperties = {
    "--x": `${pos.x}px`,
    "--y": `${pos.y}px`,
  } as React.CSSProperties;
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9997,
  };
  const toastBoxStyle: React.CSSProperties = {
    position: "fixed",
    background: "rgba(0,0,0,.7)",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: 10,
    fontSize: 13,
    zIndex: 9998,
    pointerEvents: "none",
  };
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    width: PANEL_WIDTH, maxWidth: "90vw",
    background: "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.02))",
    border: "1px solid rgba(255,255,255,.06)",
    borderRadius: 14,
    padding: 12,
    zIndex: 9998,
    boxShadow: "0 16px 40px rgba(0,0,0,.45)",
    backdropFilter: "blur(10px) saturate(140%)",
    animation: "panelIn .2s ease-out",
  };

  const orbClass = [
    "orb",
    "orb--assistant",
    menuOpen ? "is-open" : "",
    mic ? "is-mic" : "",
    dragging ? "is-dragging" : "",
    hovering ? "is-hover" : "",
    pressing ? "is-press" : "",
  ].filter(Boolean).join(" ");

  function handleOrbKeyDown(e: React.KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setMenuOpen(v => !v);
    } else if (k === "v") {
      e.preventDefault();
      mic ? stopListening() : startListening();
    } else if (k === "r") {
      e.preventDefault();
      setMenuOpen(true);
    } else if (k === "c") {
      e.preventDefault();
      setPetal("comment"); setMenuOpen(false);
    } else if (k === "m") {
      e.preventDefault();
      setPetal("remix"); setMenuOpen(false);
    } else if (k === "s") {
      e.preventDefault();
      setPetal("share"); setMenuOpen(false);
    } else if (e.key === "Escape") {
      setMenuOpen(false); setPetal(null); stopListening();
      orbRef.current?.focus();
    }
  }

  return (
    <>
      <style>{keyframes}</style>

      <button
        ref={orbRef}
        className={orbClass}
        aria-label="Assistant orb"
        title="Tap for quick menu • Hold/drag to talk • Double‑click to talk"
        style={orbStyle}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={handleOrbKeyDown}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => { setHovering(false); setPressing(false); }}
      >
        <div className="orb__core" />
        <div className="orb__ring" />
      </button>

      {/* Radial menu */}
      {menuOpen && !dragging && (
        <>
          <div
            style={overlayStyle}
            onClick={() => {
              setMenuOpen(false);
              setPetal(null);
              orbRef.current?.focus();
            }}
          />
          <RadialMenu
            center={{ x: pos.x + ORB_SIZE / 2, y: pos.y + ORB_SIZE / 2 }}
            onClose={() => {
              setMenuOpen(false);
              orbRef.current?.focus();
            }}
            onChat={() => {
              setOpen(v => !v);
              setPetal(null);
              setMenuOpen(false);
              requestAnimationFrame(updateAnchors);
            }}
            onReact={(e) => {
              handleEmojiClick(e);
              setMenuOpen(false);
            }}
            onComment={() => {
              setPetal("comment");
              setMenuOpen(false);
            }}
            onRemix={() => {
              setPetal("remix");
              setMenuOpen(false);
            }}
            onShare={() => {
              setPetal("share");
              setMenuOpen(false);
            }}
            onProfile={() => {
              if (ctxPost) bus.emit?.("profile:open", { id: (ctxPost as any).author });
              setMenuOpen(false);
            }}
            avatarUrl={(ctxPost as any)?.authorAvatar || "/avatar.jpg"}
            emojis={EMOJI_LIST.slice(0, 8)}
          />
        </>
      )}

      {/* toast + interim */}
      {toast && <div ref={toastRef} style={toastBoxStyle} aria-live="polite">{toast}</div>}
      {interim && <div ref={interimRef} style={toastBoxStyle} aria-live="polite">…{interim}</div>}

      {/* Chat panel */}
      {open && (
        <div ref={panelRef} style={panelStyle}>
          <div style={{ fontWeight: 800, paddingBottom: 4, display: "flex", alignItems: "center" }}>
            Assistant
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6, paddingLeft: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {ctxPost ? `(Context: ${ctxPost.id})` : ""}
            </span>
            <button onClick={() => setOpen(false)} style={{ marginLeft: "auto", height: 28, padding: "0 10px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.16)" }} aria-label="Close">✕</button>
          </div>

          <div ref={msgListRef} style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto", padding: "6px 0" }}>
            {msgs.length === 0 && <div style={{ fontSize: 13, opacity: .75 }}>Hold/drag or double‑click to speak, or use the quick menu.</div>}
            {msgs.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "80%", background: m.role === "user" ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.06)", padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)" }}>
                  {m.text}
                </div>
              </div>
            ))}
            {interim && (
              <div style={{ display: "flex" }}>
                <div style={{ maxWidth: "80%", background: "rgba(255,255,255,.06)", padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)" }}>
                  …{interim}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={async e => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("cmd") as HTMLInputElement);
              const t = input.value.trim();
              if (!t) return;
              input.value = "";
              await handleCommand(t);
            }}
            style={{ display: "flex", gap: 8, marginTop: 8 }}
          >
            <input
              name="cmd"
              placeholder="Type /comment hello, /react ❤️, /world, /remix"
              style={{ flex: 1, height: 36, padding: "0 10px", borderRadius: 10, outline: "none", background: "rgba(16,18,28,.65)", border: "1px solid rgba(255,255,255,.16)", color: "#fff" }}
            />
            <button
              type="button"
              onClick={() => (mic ? stopListening() : startListening())}
              style={{ height: 36, padding: "0 10px", borderRadius: 10, cursor: "pointer", background: mic ? "rgba(255,116,222,.25)" : "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", color: "#fff" }}
              aria-label={mic ? "Stop" : "Speak"}
              title={mic ? "Stop" : "Speak"}
            >
              {mic ? "🎙️" : "🎤"}
            </button>
            <button type="submit" style={{ height: 36, padding: "0 12px", borderRadius: 10, cursor: "pointer", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", color: "#fff" }} aria-label="Send">➤</button>
          </form>
        </div>
      )}

      {/* Petal drawers */}
      {petal && (
        <div className="assistant-petal">
          <div className="ap-head">
            <div className="ap-dot" />
            <div className="ap-title">{petal === "comment" ? "Comment" : petal === "remix" ? "Remix" : "Share"}</div>
            <div className="ap-sub">{ctxPost ? `Post ${ctxPost.id}` : "Hover a post to target"}</div>
            <button className="ap-btn" onClick={() => setPetal(null)}>Close</button>
          </div>

          {petal === "comment" && (
            <form
              className="ap-form"
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem("cmt") as HTMLInputElement);
                const t = input.value.trim();
                if (!t || !ctxPost) return;
                bus.emit?.("post:comment", { id: ctxPost.id, body: t });
                input.value = "";
                setPetal(null);
              }}
            >
              <input className="ap-input" name="cmt" placeholder="Write a comment…" />
              <button className="ap-send" type="submit">Send</button>
            </form>
          )}

          {petal === "remix" && (
            <div className="ap-body">
              <div className="ap-hint">Make a quick remix of the current post. Uses defaults.</div>
              <button className="ap-btn" onClick={() => { if (ctxPost) { bus.emit?.("post:remix", { id: ctxPost.id }); setPetal(null); } }}>
                Remix 🎬
              </button>
            </div>
          )}

          {petal === "share" && (
            <div className="ap-body">
              <div className="ap-hint">Copy link to this post.</div>
              <button
                className="ap-btn"
                onClick={async () => {
                  if (!ctxPost) return;
                  const url = `${location.origin}${location.pathname}#post-${ctxPost.id}`;
                  try { await navigator.clipboard.writeText(url); setToast("Link copied"); setTimeout(() => setToast(""), 900); } catch {}
                  setPetal(null);
                }}
              >
                Copy Link ↗️
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

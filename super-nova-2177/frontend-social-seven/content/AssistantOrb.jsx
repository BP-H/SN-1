"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { normalizeAvatarValue } from "@/utils/avatar";
import { FaCommentAlt, FaShare } from "react-icons/fa";
import {
  IoChatbubbleEllipsesOutline,
  IoClose,
  IoKeyOutline,
  IoPlanetOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { RiVoiceAiFill } from "react-icons/ri";
import { BiSolidDislike, BiSolidLike } from "react-icons/bi";
import { API_BASE_URL } from "@/utils/apiBase";
import { authHeaders } from "@/utils/authSession";
import { MentionAutocomplete, useMentionAutocomplete } from "@/utils/mentionAutocomplete";
import { useUser } from "@/content/profile/UserContext";

const KEY_STORAGE = "supernova-ai-cursor-key";
const ORB_SIZE = 56;
const DIAL_SIZE = 184;

const AiWidgetIcon = ({ className = "" }) => <RiVoiceAiFill className={className} />;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isKeyboardEditable(element) {
  if (!element?.closest?.("[data-ai-cursor-root]")) return false;
  const tag = element.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || Boolean(element.isContentEditable);
}

function fallbackFor(action, target) {
  const title = target?.title || "this post";
  const author = target?.author || "the author";
  const text = target?.text || title;

  if (action === "brief") {
    return `${title} by ${author}. Core signal: ${text.slice(0, 150)}${text.length > 150 ? "..." : ""}`;
  }

  if (action === "comment") {
    return "Strong signal. I would love to see the next step framed across humans, AI, and ORGs so the vote can turn into action.";
  }

  return "Post selected. Comments are open so you can engage directly.";
}

function buildPrompt(action, target) {
  const text = target?.text || "";
  if (action === "comment") {
    return `Write one concise, thoughtful social-network comment for this SuperNova post. Keep it human, constructive, and not salesy.\n\nAuthor: ${target?.author}\nTitle: ${target?.title}\nText: ${text}`;
  }
  return `Summarize this SuperNova social post in two short bullets and name one useful next action.\n\nAuthor: ${target?.author}\nTitle: ${target?.title}\nText: ${text}`;
}

export default function AssistantOrb() {
  const router = useRouter();
  const { userData, isAuthenticated } = useUser();
  const dockRef = useRef(null);
  const orbRef = useRef(null);
  const commentInputRef = useRef(null);
  const hoverElementRef = useRef(null);
  const returnTimerRef = useRef(null);
  const keyboardFocusRef = useRef(false);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    offsetX: ORB_SIZE / 2,
    offsetY: ORB_SIZE / 2,
    source: "dock",
  });
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ghostVisible, setGhostVisible] = useState(false);
  const [returning, setReturning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [lastSignal, setLastSignal] = useState(null);
  const mentionAutocomplete = useMentionAutocomplete({
    value: commentText,
    setValue: setCommentText,
    inputRef: commentInputRef,
  });
  const trackCommentMentionCaret = mentionAutocomplete.trackCaret;

  const getDockPosition = useCallback(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        x: Math.max(8, window.innerWidth - ORB_SIZE - 10),
        y: Math.max(8, 12 + (40 - ORB_SIZE) / 2),
      };
    }
    return {
      x: clamp(rect.left + rect.width / 2 - ORB_SIZE / 2, 8, window.innerWidth - ORB_SIZE - 8),
      y: clamp(rect.top + rect.height / 2 - ORB_SIZE / 2, 8, window.innerHeight - ORB_SIZE - 8),
    };
  }, []);

  const getPostElementAtPoint = useCallback((x, y) => {
    const orb = orbRef.current;
    if (orb) orb.style.pointerEvents = "none";
    const element = document.elementFromPoint(x, y);
    if (orb) orb.style.pointerEvents = "";
    return element?.closest?.("[data-proposal-card]") || null;
  }, []);

  const getPostData = useCallback((post) => {
    if (!post) return null;
    return {
      id: post.dataset.proposalId,
      title: post.dataset.proposalTitle || "Selected post",
      author: post.dataset.proposalAuthor || "Unknown",
      text: post.dataset.proposalText || post.dataset.proposalTitle || "",
      userVote: post.dataset.proposalUserVote || "",
    };
  }, []);

  const clearHover = useCallback(() => {
    hoverElementRef.current?.classList.remove("ai-cursor-target");
    hoverElementRef.current = null;
    setHoverTarget(null);
  }, []);

  const returnToDock = useCallback(() => {
    if (typeof window === "undefined") return;
    window.clearTimeout(returnTimerRef.current);
    clearHover();
    setMenuOpen(false);
    setSettingsOpen(false);
    setCommentOpen(false);
    setReply("");
    setDragging(false);
    setReturning(true);
    setPos(getDockPosition());
    returnTimerRef.current = window.setTimeout(() => {
      setGhostVisible(false);
      setReturning(false);
      dockRef.current?.classList.remove("ai-cursor-dock-hidden");
    }, 460);
  }, [clearHover, getDockPosition]);

  useEffect(() => {
    setMounted(true);
    setApiKey(localStorage.getItem(KEY_STORAGE) || "");
    const frame = window.requestAnimationFrame(() => setPos(getDockPosition()));
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(returnTimerRef.current);
    };
  }, [getDockPosition]);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleResize = () => {
      if (!dragRef.current.active && !ghostVisible && !menuOpen && !settingsOpen && !commentOpen && !reply) {
        setPos(getDockPosition());
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [commentOpen, getDockPosition, ghostVisible, menuOpen, mounted, reply, settingsOpen]);

  useEffect(() => {
    if (!mounted) return undefined;

    const syncKeyboardFocus = () => {
      keyboardFocusRef.current = isKeyboardEditable(document.activeElement);
    };
    const syncAfterFocusLeaves = () => {
      window.setTimeout(syncKeyboardFocus, 0);
    };

    document.addEventListener("focusin", syncKeyboardFocus);
    document.addEventListener("focusout", syncAfterFocusLeaves);
    syncKeyboardFocus();
    return () => {
      document.removeEventListener("focusin", syncKeyboardFocus);
      document.removeEventListener("focusout", syncAfterFocusLeaves);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleMove = (event) => {
      if (!dragRef.current.active) return;
      const nextX = clamp(event.clientX - dragRef.current.offsetX, 8, window.innerWidth - ORB_SIZE - 8);
      const nextY = clamp(event.clientY - dragRef.current.offsetY, 70, window.innerHeight - ORB_SIZE - 8);
      const moved =
        Math.abs(event.clientX - dragRef.current.startX) > 5 ||
        Math.abs(event.clientY - dragRef.current.startY) > 5;
      dragRef.current = {
        ...dragRef.current,
        moved: dragRef.current.moved || moved,
        x: event.clientX,
        y: event.clientY,
      };
      setPos({ x: nextX, y: nextY });

      const hoveredPost = getPostElementAtPoint(event.clientX, event.clientY);
      if (hoveredPost !== hoverElementRef.current) {
        hoverElementRef.current?.classList.remove("ai-cursor-target");
        hoveredPost?.classList.add("ai-cursor-target");
        hoverElementRef.current = hoveredPost;
        setHoverTarget(hoveredPost ? getPostData(hoveredPost) : null);
      }
    };

    const handleUp = () => {
      if (!dragRef.current.active) return;
      const wasMoved = dragRef.current.moved;
      const point = { x: dragRef.current.x, y: dragRef.current.y };
      const source = dragRef.current.source;
      dragRef.current.active = false;
      setDragging(false);
      clearHover();

      if (wasMoved) {
        const nextTarget = getPostData(getPostElementAtPoint(point.x, point.y));
        if (nextTarget) {
          setTarget(nextTarget);
          setReply("");
          setSettingsOpen(false);
          setCommentOpen(false);
          setMenuOpen(true);
          setGhostVisible(true);
          return;
        }
        returnToDock();
        return;
      }

      if (source === "orb") {
        setGhostVisible(true);
        setSettingsOpen(false);
        setCommentOpen(false);
        setReply("");
        setMenuOpen((value) => (target ? !value : true));
        if (!target) setReply("Drag the AI cursor onto a post first.");
        return;
      }

      setGhostVisible(true);
      setMenuOpen(false);
      setCommentOpen(false);
      setReply("");
      setSettingsOpen((value) => !value);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [clearHover, getPostData, getPostElementAtPoint, mounted, returnToDock, target]);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleOutside = (event) => {
      const hasActiveUi = ghostVisible || menuOpen || settingsOpen || commentOpen || Boolean(reply);
      if (!hasActiveUi || dragRef.current.active) return;
      if (event.target?.closest?.("[data-ai-cursor-root]")) return;
      returnToDock();
    };

    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [commentOpen, ghostVisible, menuOpen, mounted, reply, returnToDock, settingsOpen]);

  useEffect(() => {
    if (!commentOpen) return undefined;
    const timer = window.setTimeout(() => {
      const textarea = commentInputRef.current;
      if (!textarea) return;
      textarea.focus();
      const caret = textarea.value.length;
      textarea.setSelectionRange(caret, caret);
      trackCommentMentionCaret(textarea);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [commentOpen, trackCommentMentionCaret]);

  useEffect(() => {
    setLastSignal(target?.userVote || null);
  }, [target?.id, target?.userVote]);

  useEffect(() => {
    if (!mounted) return undefined;

    const retreat = (event) => {
      if (dragRef.current.active) return;
      if (event?.target?.closest?.("[data-ai-cursor-root]")) return;
      if (event?.type !== "wheel" && keyboardFocusRef.current && isKeyboardEditable(document.activeElement)) return;
      if (menuOpen || settingsOpen || commentOpen || reply) returnToDock();
    };
    const escape = (event) => {
      if (event.key === "Escape") returnToDock();
    };

    window.addEventListener("scroll", retreat, { passive: true });
    window.addEventListener("wheel", retreat, { passive: true });
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", retreat);
      window.removeEventListener("wheel", retreat);
      window.removeEventListener("keydown", escape);
    };
  }, [commentOpen, menuOpen, mounted, reply, returnToDock, settingsOpen]);

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(returnTimerRef.current);

    const fromDock = event.currentTarget === dockRef.current;
    const startPos = fromDock ? getDockPosition() : pos;
    if (fromDock) dockRef.current?.classList.add("ai-cursor-dock-hidden");
    setPos(startPos);
    setGhostVisible(true);
    setReturning(false);
    setDragging(true);
    setMenuOpen(false);
    setSettingsOpen(false);
    setCommentOpen(false);
    setReply("");
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: clamp(event.clientX - startPos.x, 8, ORB_SIZE - 8),
      offsetY: clamp(event.clientY - startPos.y, 8, ORB_SIZE - 8),
      source: fromDock ? "dock" : "orb",
    };
  };

  const persistKey = (value) => {
    setApiKey(value);
    if (value.trim()) localStorage.setItem(KEY_STORAGE, value.trim());
    else localStorage.removeItem(KEY_STORAGE);
  };

  const closeActivePanel = () => {
    setSettingsOpen(false);
    setCommentOpen(false);
    setReply("");
    setBusy(false);
    if (target) setMenuOpen(true);
    setGhostVisible(true);
  };

  const runAction = async (action) => {
    if (action === "universe") {
      setMenuOpen(false);
      setSettingsOpen(false);
      setCommentOpen(false);
      setReply("");
      setGhostVisible(false);
      dockRef.current?.classList.remove("ai-cursor-dock-hidden");
      router.push("/universe");
      return;
    }

    if (action === "key") {
      setSettingsOpen((value) => !value);
      setCommentOpen(false);
      setReply("");
      setMenuOpen(Boolean(target));
      return;
    }

    if (!target && action !== "key") {
      setReply("Drag the AI cursor onto a post first.");
      setMenuOpen(true);
      return;
    }

    if (action === "like" || action === "dislike") {
      if (!isAuthenticated) {
        setMenuOpen(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
        }
        return;
      }
      const shouldRemove = lastSignal === action;
      window.dispatchEvent(
        new CustomEvent("supernova:post-action", {
          detail: { id: target.id, action, source: "ai-widget", allowToggle: shouldRemove },
        })
      );
      setLastSignal(shouldRemove ? null : action);
      setTarget((value) => (value ? { ...value, userVote: shouldRemove ? "" : action } : value));
      setReply("");
      setSettingsOpen(false);
      setCommentOpen(false);
      setMenuOpen(true);
      return;
    }

    if (action === "engage") {
      if (!isAuthenticated) {
        setMenuOpen(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
        }
        return;
      }
      setCommentText(fallbackFor("comment", target));
      setCommentOpen(true);
      setSettingsOpen(false);
      setReply("");
      setMenuOpen(true);
      return;
    }

    if (action === "comment") {
      if (!isAuthenticated) {
        setMenuOpen(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
        }
        return;
      }
      setCommentText("");
      setCommentOpen(true);
      setMenuOpen(true);
      setSettingsOpen(false);
      setReply("");
      return;
    }

    if (action === "share") {
      const url = `${window.location.origin}/proposals/${target.id}`;
      try {
        await navigator.clipboard?.writeText?.(url);
        setReply("Post link copied.");
        setMenuOpen(true);
      } catch {
        setReply(url);
        setMenuOpen(true);
      }
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(action, target), apiKey: apiKey.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      const aiReply =
        response.ok && data?.reply && !String(data.reply).includes("Missing OPENAI_API_KEY")
          ? data.reply
          : fallbackFor(action, target);
      setReply(aiReply);
      setMenuOpen(true);
    } catch {
      setReply(fallbackFor(action, target));
      setMenuOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    const value = commentText.trim();
    if (!target || !value) return;
    if (!isAuthenticated || !userData?.name) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
      }
      return;
    }

    setCommentSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          proposal_id: Number(target.id),
          user: userData.name,
          user_img: normalizeAvatarValue(userData.avatar || ""),
          species: userData.species || "human",
          comment: value,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || "Comment failed.");
      }

      const payload = await response.json().catch(() => ({}));
      const newComment = payload?.comments?.[0] || {
        proposal_id: Number(target.id),
        user: userData.name,
        user_img: normalizeAvatarValue(userData.avatar || ""),
        species: userData.species || "human",
        comment: value,
      };
      window.dispatchEvent(
        new CustomEvent("supernova:post-action", {
          detail: { id: target.id, action: "comment-posted", comment: newComment },
        })
      );
      setCommentText("");
      setCommentOpen(false);
      setReply("Comment posted.");
      setMenuOpen(true);
    } catch (error) {
      setReply(error.message || "Comment failed.");
    } finally {
      setCommentSending(false);
    }
  };

  const actions = [
    { action: "dislike", label: "Challenge", icon: BiSolidDislike, dx: -56, dy: -88, size: "primary", tone: "blue" },
    { action: "like", label: "Support", icon: BiSolidLike, dx: 56, dy: -88, size: "primary", tone: "pink" },
    { action: "comment", label: "Comment", icon: FaCommentAlt, dx: -100, dy: -28 },
    { action: "brief", label: "Brief", icon: IoSparklesOutline, dx: 100, dy: -28 },
    { action: "engage", label: "Draft", icon: IoChatbubbleEllipsesOutline, dx: -90, dy: 48 },
    { action: "share", label: "Share", icon: FaShare, dx: 90, dy: 48 },
    { action: "universe", label: "Universe", icon: IoPlanetOutline, dx: -34, dy: 96 },
    { action: "key", label: "AI key", icon: IoKeyOutline, dx: 34, dy: 96 },
  ];
  const dockHidden = dragging || ghostVisible || menuOpen || settingsOpen || commentOpen || Boolean(reply);
  const floatingPanelStyle =
    mounted && typeof window !== "undefined"
      ? (() => {
          const width = Math.min(window.innerWidth - 16, 352);
          const viewport = window.visualViewport;
          const viewportTop = viewport?.offsetTop || 0;
          const viewportHeight = viewport?.height || window.innerHeight;
          const panelHeight = commentOpen ? 246 : settingsOpen ? 132 : 168;
          const rightRoom = window.innerWidth - (pos.x + ORB_SIZE + 12);
          const leftRoom = pos.x - 12;
          const canUseSide = Math.max(rightRoom, leftRoom) >= width;
          const desiredLeft =
            canUseSide && rightRoom >= leftRoom
              ? pos.x + ORB_SIZE + 12
              : canUseSide
              ? pos.x - width - 12
              : 8;
          const desiredTop = canUseSide
            ? pos.y + ORB_SIZE / 2 - panelHeight / 2
            : pos.y > window.innerHeight / 2
            ? pos.y - panelHeight - 92
            : pos.y + ORB_SIZE + 92;
          const minTop = Math.max(72, viewportTop + 8);
          const maxTop = Math.max(minTop, viewportTop + viewportHeight - panelHeight - 8);
          return {
            width: `${width}px`,
            left: `${clamp(desiredLeft, 8, window.innerWidth - width - 8)}px`,
            top: `${clamp(desiredTop, minTop, maxTop)}px`,
          };
        })()
      : {};

  const floatingUi = (
    <>
      {ghostVisible && (
        <div
          ref={orbRef}
          data-ai-cursor-root
          className={`fixed z-[2147482500] ${dragging ? "" : "transition-[left,top,opacity,transform] duration-500 ease-out"} ${
            returning ? "ai-cursor-returning scale-75 opacity-60" : "scale-100 opacity-100"
          }`}
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        >
          <button
            data-ai-cursor-root
            type="button"
            onPointerDown={startDrag}
            aria-label="Drag SuperNova AI cursor"
            className={`ai-cursor-core flex h-14 w-14 items-center justify-center rounded-full text-white ${
              dragging ? "scale-105 cursor-grabbing" : "cursor-grab"
            }`}
          >
            <AiWidgetIcon className="text-[1.7rem]" />
          </button>
        </div>
      )}

      {dragging && hoverTarget && (
        <div
          data-ai-cursor-root
          className="ai-cursor-tooltip pointer-events-none fixed z-[2147482502] max-w-[15rem] rounded-full px-3 py-2 text-[0.72rem] font-semibold backdrop-blur-xl"
          style={{
            left: clamp(pos.x - 82, 8, window.innerWidth - 248),
            top: Math.max(80, pos.y - 44),
          }}
        >
          Targeting {hoverTarget.title}
        </div>
      )}

      {menuOpen && (
        <>
          <div
            data-ai-cursor-root
            className="pointer-events-none fixed z-[2147482500] rounded-full ai-cursor-dial"
            style={{
              left: pos.x + ORB_SIZE / 2 - DIAL_SIZE / 2,
              top: pos.y + ORB_SIZE / 2 - DIAL_SIZE / 2,
              "--ai-dial-size": `${DIAL_SIZE}px`,
            }}
          />
          {actions.map((item) => {
            const Icon = item.icon;
            const buttonSize = item.size === "primary" ? 46 : 42;
            const centerX = pos.x + ORB_SIZE / 2;
            const centerY = pos.y + ORB_SIZE / 2;
            const signalActive = item.action === lastSignal;
            return (
              <button
                key={item.action}
                data-ai-cursor-root
                data-active={signalActive ? "true" : "false"}
                data-tone={item.tone || "neutral"}
                type="button"
                onClick={() => runAction(item.action)}
                className="ai-cursor-action-button fixed z-[2147482502] flex items-center justify-center rounded-full backdrop-blur-xl transition-transform active:scale-95"
                style={{
                  left: clamp(centerX + item.dx - buttonSize / 2, 8, window.innerWidth - buttonSize - 8),
                  top: clamp(centerY + item.dy - buttonSize / 2, 72, window.innerHeight - buttonSize - 8),
                  width: buttonSize,
                  height: buttonSize,
                }}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className={item.size === "primary" ? "text-[1.16rem]" : "text-[1rem]"} />
              </button>
            );
          })}
        </>
      )}

      {(settingsOpen || commentOpen || busy || reply) && (
        <div
          data-ai-cursor-root
          className="ai-cursor-panel fixed z-[2147482503] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[1rem] p-3 backdrop-blur-xl"
          style={floatingPanelStyle}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--pink)]">
                {settingsOpen ? "AI Key" : commentOpen ? "Comment" : "AI Cursor"}
              </p>
              <p className="truncate text-[0.82rem] text-[var(--text-gray-light)]">
                {target ? target.title : "Local mode is active"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeActivePanel}
              className="ai-cursor-panel-icon-button flex h-8 w-8 items-center justify-center rounded-full text-[0.9rem] font-semibold"
              aria-label="Close popup"
              title="Close popup"
            >
              <IoClose />
            </button>
          </div>

          {settingsOpen && (
            <input
              value={apiKey}
              onChange={(event) => persistKey(event.target.value)}
              type="password"
              placeholder="OpenAI API key for local testing"
              className="ai-cursor-field mt-3 w-full rounded-[0.8rem] px-3 py-2 text-[0.78rem] outline-none"
            />
          )}

          {commentOpen && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(event) => {
                    setCommentText(event.target.value);
                    mentionAutocomplete.trackCaret(event.currentTarget);
                  }}
                  onClick={(event) => mentionAutocomplete.trackCaret(event.currentTarget)}
                  onKeyDown={mentionAutocomplete.handleKeyDown}
                  onKeyUp={(event) => mentionAutocomplete.trackCaret(event.currentTarget)}
                  placeholder="Write a comment..."
                  className="ai-cursor-field min-h-24 w-full rounded-[0.85rem] px-3 py-2 text-[0.84rem] outline-none"
                />
                <MentionAutocomplete controller={mentionAutocomplete} withinAiCursor />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeActivePanel}
                  className="ai-cursor-secondary-button rounded-full px-3 py-2 text-[0.76rem] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={!commentText.trim() || commentSending}
                  className="rounded-full bg-[var(--pink)] px-4 py-2 text-[0.76rem] font-semibold text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
                >
                  {commentSending ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          )}

          {(busy || reply) && (
            <div className="ai-cursor-result-box mt-3 max-h-36 overflow-y-auto rounded-[0.85rem] p-3 text-[0.78rem] leading-5">
              {busy ? "Thinking..." : reply}
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      <button
        ref={dockRef}
        data-ai-cursor-root
        type="button"
        onPointerDown={startDrag}
        aria-label="SuperNova AI cursor"
        aria-hidden={dockHidden}
        className={`mobile-topbar-action ai-cursor-dock flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-all duration-150 ${
          dockHidden ? "ai-cursor-dock-hidden pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <AiWidgetIcon className="text-[1.12rem]" />
      </button>

      {mounted && typeof document !== "undefined" ? createPortal(floatingUi, document.body) : null}
    </>
  );
}

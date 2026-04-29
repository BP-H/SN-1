"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/utils/apiBase";

const MAX_MENTION_USERNAME_LENGTH = 80;
const MENTION_PREFIX_DISALLOWED = /[A-Za-z0-9_.+/\-]/;
const PARTIAL_USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const PANEL_MAX_WIDTH = 384;
const PANEL_MAX_HEIGHT = 224;
const VIEWPORT_GUTTER = 8;

function findActiveMention(value = "", caretIndex = 0) {
  const text = String(value || "");
  const caret = Math.max(0, Math.min(Number(caretIndex) || 0, text.length));
  const beforeCaret = text.slice(0, caret);
  const atIndex = beforeCaret.lastIndexOf("@");

  if (atIndex < 0) return null;
  if (atIndex > 0 && MENTION_PREFIX_DISALLOWED.test(text[atIndex - 1])) return null;

  const query = beforeCaret.slice(atIndex + 1);
  if (!query || query.length > MAX_MENTION_USERNAME_LENGTH) return null;
  if (!PARTIAL_USERNAME_PATTERN.test(query)) return null;

  return { start: atIndex, end: caret, query };
}

function normalizeUsers(payload) {
  if (!Array.isArray(payload)) return [];
  const seen = new Set();
  return payload
    .map((item) => ({
      username: String(item?.username || "").trim(),
      species: String(item?.species || "human").trim() || "human",
      initials: String(item?.initials || item?.username || "SN").slice(0, 2).toUpperCase(),
    }))
    .filter((item) => {
      const key = item.username.toLowerCase();
      if (!item.username || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function useMentionAutocomplete({ value, setValue, inputRef, limit = 6 }) {
  const [caretIndex, setCaretIndex] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const activeMention = useMemo(() => findActiveMention(value, caretIndex), [value, caretIndex]);

  const trackCaret = useCallback((element) => {
    if (!element) return;
    setCaretIndex(Number(element.selectionStart) || 0);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSuggestions([]);
    setSelectedIndex(0);
  }, []);

  const selectUser = useCallback(
    (user) => {
      if (!activeMention || !user?.username) return;
      const before = String(value || "").slice(0, activeMention.start);
      const after = String(value || "").slice(activeMention.end);
      const inserted = `@${user.username} `;
      const nextValue = `${before}${inserted}${after}`;
      const nextCaret = before.length + inserted.length;

      setValue(nextValue);
      close();
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(nextCaret, nextCaret);
        setCaretIndex(nextCaret);
      });
    },
    [activeMention, close, inputRef, setValue, value]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (!open || suggestions.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((index) => (index + 1) % suggestions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        selectUser(suggestions[selectedIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    [close, open, selectUser, selectedIndex, suggestions]
  );

  useEffect(() => {
    if (!activeMention) {
      close();
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/social-users?search=${encodeURIComponent(activeMention.query)}&limit=${limit}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          close();
          return;
        }
        const users = normalizeUsers(await response.json());
        setSuggestions(users);
        setSelectedIndex(0);
        setOpen(users.length > 0);
      } catch (error) {
        if (error?.name !== "AbortError") close();
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeMention, close, limit]);

  return {
    open,
    suggestions,
    selectedIndex,
    inputRef,
    trackCaret,
    handleKeyDown,
    selectUser,
    close,
  };
}

function panelPlacement(inputRef) {
  if (typeof window === "undefined") return null;
  const anchor = inputRef?.current;
  const rect = anchor?.getBoundingClientRect?.();
  if (!rect) return null;

  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const availableWidth = Math.max(160, viewportWidth - VIEWPORT_GUTTER * 2);
  const width = Math.min(PANEL_MAX_WIDTH, Math.max(168, Math.min(rect.width, availableWidth)));
  const left = Math.min(
    Math.max(rect.left, viewportLeft + VIEWPORT_GUTTER),
    viewportLeft + viewportWidth - width - VIEWPORT_GUTTER
  );
  const below = viewportTop + viewportHeight - rect.bottom - VIEWPORT_GUTTER;
  const above = rect.top - viewportTop - VIEWPORT_GUTTER;
  const placeAbove = below < 150 && above > below;
  const maxHeight = Math.max(124, Math.min(PANEL_MAX_HEIGHT, (placeAbove ? above : below) - VIEWPORT_GUTTER));
  const top = placeAbove
    ? Math.max(viewportTop + VIEWPORT_GUTTER, rect.top - maxHeight - VIEWPORT_GUTTER)
    : Math.min(rect.bottom + VIEWPORT_GUTTER, viewportTop + viewportHeight - maxHeight - VIEWPORT_GUTTER);

  return { left, top, width, maxHeight };
}

export function MentionAutocomplete({ controller, withinAiCursor = false }) {
  const [mounted, setMounted] = useState(false);
  const [placement, setPlacement] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!controller?.open || !controller.suggestions?.length) {
      setPlacement(null);
      return undefined;
    }

    const update = () => setPlacement(panelPlacement(controller.inputRef));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener?.("resize", update);
    window.visualViewport?.addEventListener?.("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener?.("resize", update);
      window.visualViewport?.removeEventListener?.("scroll", update);
    };
  }, [controller?.inputRef, controller?.open, controller?.suggestions?.length]);

  if (!controller?.open || !controller.suggestions?.length) return null;
  if (!mounted || typeof document === "undefined" || !placement) return null;

  const panel = (
    <div
      data-ai-cursor-root={withinAiCursor ? "true" : undefined}
      className="fixed z-[2147482600] overflow-y-auto overflow-x-hidden rounded-[0.9rem] border border-white/10 bg-[#090d14]/95 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.42)] ring-1 ring-white/[0.04] backdrop-blur-2xl [scrollbar-color:rgba(255,255,255,0.22)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/35"
      style={{
        left: `${placement.left}px`,
        top: `${placement.top}px`,
        width: `${placement.width}px`,
        maxHeight: `${placement.maxHeight}px`,
      }}
    >
      {controller.suggestions.map((user, index) => {
        const active = index === controller.selectedIndex;
        return (
          <button
            key={user.username}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => controller.selectUser(user)}
            className={`flex w-full min-w-0 items-center gap-2 rounded-[0.72rem] px-2 py-1.5 text-left transition-colors ${
              active
                ? "bg-[var(--pink)] text-white shadow-[0_0_18px_rgba(255,79,143,0.24)]"
                : "text-[var(--transparent-black)] hover:bg-white/[0.075]"
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[0.62rem] font-black uppercase ring-1 ring-white/10">
              {user.initials}
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.8rem] font-semibold">@{user.username}</span>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em] ${
              active ? "bg-white/15 text-white/80" : "bg-white/[0.055] text-[var(--text-gray-light)]"
            }`}>
              {user.species}
            </span>
          </button>
        );
      })}
    </div>
  );

  return createPortal(panel, document.body);
}

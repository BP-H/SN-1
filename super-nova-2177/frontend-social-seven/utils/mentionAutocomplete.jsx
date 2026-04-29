"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/utils/apiBase";

const MAX_MENTION_USERNAME_LENGTH = 80;
const MENTION_PREFIX_DISALLOWED = /[A-Za-z0-9_.+/\-]/;
const PARTIAL_USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

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
        setSelectedIndex((index) => (index + 1) % suggestions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectUser(suggestions[selectedIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
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
    trackCaret,
    handleKeyDown,
    selectUser,
    close,
  };
}

export function MentionAutocomplete({ controller }) {
  if (!controller?.open || !controller.suggestions?.length) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-56 overflow-auto rounded-[0.95rem] border border-[var(--horizontal-line)] bg-[var(--surface-strong)] p-1.5 shadow-[var(--shadow)] backdrop-blur-xl">
      {controller.suggestions.map((user, index) => {
        const active = index === controller.selectedIndex;
        return (
          <button
            key={user.username}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => controller.selectUser(user)}
            className={`flex w-full min-w-0 items-center gap-2 rounded-[0.75rem] px-2.5 py-2 text-left transition-colors ${
              active ? "bg-[var(--pink)] text-white" : "text-[var(--transparent-black)] hover:bg-white/[0.07]"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[0.68rem] font-black uppercase">
              {user.initials}
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.84rem] font-semibold">@{user.username}</span>
            <span className={`shrink-0 text-[0.66rem] ${active ? "text-white/75" : "text-[var(--text-gray-light)]"}`}>
              {user.species}
            </span>
          </button>
        );
      })}
    </div>
  );
}

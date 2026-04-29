"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/utils/apiBase";

const MENTION_PATTERN = /@([A-Za-z0-9_]+(?:[.-][A-Za-z0-9_]+)*)/g;
const MAX_MENTION_USERNAME_LENGTH = 80;
const MENTION_PREFIX_DISALLOWED = /[A-Za-z0-9_.+/\-]/;
const MENTION_SUFFIX_DISALLOWED = /[A-Za-z0-9_@-]/;
const verifiedMentionCache = new Map();

function canStartMention(value, index) {
  if (index <= 0) return true;
  return !MENTION_PREFIX_DISALLOWED.test(value[index - 1]);
}

function canEndMention(value, index) {
  if (index >= value.length) return true;
  return !MENTION_SUFFIX_DISALLOWED.test(value[index]);
}

function normalizeMentionUsername(value = "") {
  return String(value || "").replace(/^@/, "").trim().toLowerCase();
}

export function extractMentionUsernames(textInput = "") {
  const values = Array.isArray(textInput) ? textInput : [textInput];
  const seen = new Set();
  const usernames = [];

  values.forEach((item) => {
    const value = String(item || "");
    MENTION_PATTERN.lastIndex = 0;
    let match;
    while ((match = MENTION_PATTERN.exec(value)) !== null) {
      const username = match[1] || "";
      const start = match.index;
      const end = start + match[0].length;
      const key = normalizeMentionUsername(username);
      if (
        !key ||
        seen.has(key) ||
        username.length > MAX_MENTION_USERNAME_LENGTH ||
        !canStartMention(value, start) ||
        !canEndMention(value, end)
      ) {
        continue;
      }
      seen.add(key);
      usernames.push(key);
    }
  });

  return usernames;
}

function responseUsers(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function usernameExists(username, signal) {
  const response = await fetch(
    `${API_BASE_URL}/social-users?search=${encodeURIComponent(username)}&limit=8`,
    { signal }
  );
  if (!response.ok) return false;
  const users = responseUsers(await response.json().catch(() => []));
  return users.some((user) => normalizeMentionUsername(user?.username) === username);
}

export function useVerifiedMentionUsernames(textInput = "") {
  const [version, setVersion] = useState(0);
  const candidates = useMemo(() => extractMentionUsernames(textInput), [textInput]);

  useEffect(() => {
    if (!candidates.length) return undefined;
    const missing = candidates.filter((username) => !verifiedMentionCache.has(username));
    if (!missing.length) {
      setVersion((value) => value + 1);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    Promise.all(
      missing.map(async (username) => {
        try {
          verifiedMentionCache.set(username, await usernameExists(username, controller.signal));
        } catch (error) {
          if (error?.name !== "AbortError") verifiedMentionCache.set(username, false);
        }
      })
    ).finally(() => {
      if (active) setVersion((value) => value + 1);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [candidates]);

  return useMemo(() => {
    void version;
    return new Set(candidates.filter((username) => verifiedMentionCache.get(username) === true));
  }, [candidates, version]);
}

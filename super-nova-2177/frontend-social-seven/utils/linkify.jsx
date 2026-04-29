"use client";

import Link from "next/link";

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const MENTION_PATTERN = /@([A-Za-z0-9_]+(?:[.-][A-Za-z0-9_]+)*)/g;
const MAX_MENTION_USERNAME_LENGTH = 80;
const MENTION_PREFIX_DISALLOWED = /[A-Za-z0-9_.+/\-]/;
const MENTION_SUFFIX_DISALLOWED = /[A-Za-z0-9_@-]/;

function cleanUrl(raw = "") {
  return raw.replace(/[),.;!?]+$/g, "");
}

function trailingText(raw = "", clean = "") {
  return raw.slice(clean.length);
}

export function hasLink(text = "") {
  URL_PATTERN.lastIndex = 0;
  return URL_PATTERN.test(text);
}

export function normalizeLinkHref(value = "") {
  const clean = cleanUrl(value.trim());
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  return `https://${clean}`;
}

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

function isVerifiedMention(username = "", validMentionUsernames) {
  if (validMentionUsernames === undefined || validMentionUsernames === null) return true;
  const key = normalizeMentionUsername(username);
  if (!key) return false;
  if (validMentionUsernames instanceof Set) return validMentionUsernames.has(key);
  if (Array.isArray(validMentionUsernames)) {
    return validMentionUsernames.some((item) => normalizeMentionUsername(item) === key);
  }
  if (typeof validMentionUsernames === "object") {
    return Boolean(validMentionUsernames[key] || validMentionUsernames[username]);
  }
  return false;
}

function renderMentionParts(value = "", keyPrefix = "mention", validMentionUsernames) {
  MENTION_PATTERN.lastIndex = 0;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = MENTION_PATTERN.exec(value)) !== null) {
    const raw = match[0];
    const username = match[1];
    const start = match.index;
    const end = start + raw.length;

    if (
      username.length > MAX_MENTION_USERNAME_LENGTH ||
      !canStartMention(value, start) ||
      !canEndMention(value, end) ||
      !isVerifiedMention(username, validMentionUsernames)
    ) {
      continue;
    }

    if (start > lastIndex) {
      parts.push(value.slice(lastIndex, start));
    }
    parts.push(
      <Link
        key={`${keyPrefix}-${start}-${username}`}
        href={`/users/${encodeURIComponent(username)}`}
        onClick={(event) => event.stopPropagation()}
        className="linkified-url linkified-mention"
      >
        {raw}
      </Link>
    );
    lastIndex = end;
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  return parts.length ? parts : [value];
}

export default function LinkifiedText({
  text = "",
  className = "",
  enableMentions = false,
  validMentionUsernames,
}) {
  const value = String(text || "");
  URL_PATTERN.lastIndex = 0;
  const parts = [];
  let lastIndex = 0;
  let match;

  const appendText = (chunk, keyPrefix) => {
    if (!chunk) return;
    if (!enableMentions) {
      parts.push(chunk);
      return;
    }
    parts.push(...renderMentionParts(chunk, keyPrefix, validMentionUsernames));
  };

  while ((match = URL_PATTERN.exec(value)) !== null) {
    const raw = match[0];
    const clean = cleanUrl(raw);
    const href = normalizeLinkHref(clean);
    if (match.index > lastIndex) {
      appendText(value.slice(lastIndex, match.index), `text-${lastIndex}`);
    }
    parts.push(
      <a
        key={`${match.index}-${clean}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="linkified-url"
      >
        {clean}
      </a>
    );
    const trailing = trailingText(raw, clean);
    appendText(trailing, `trailing-${match.index}`);
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < value.length) {
    appendText(value.slice(lastIndex), `text-${lastIndex}`);
  }

  return <span className={className}>{parts.length ? parts : value}</span>;
}

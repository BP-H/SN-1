"use client";

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

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

export default function LinkifiedText({ text = "", className = "" }) {
  const value = String(text || "");
  URL_PATTERN.lastIndex = 0;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = URL_PATTERN.exec(value)) !== null) {
    const raw = match[0];
    const clean = cleanUrl(raw);
    const href = normalizeLinkHref(clean);
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
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
    if (trailing) parts.push(trailing);
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  return <span className={className}>{parts.length ? parts : value}</span>;
}

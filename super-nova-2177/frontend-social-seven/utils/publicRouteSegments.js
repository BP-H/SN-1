const UNSAFE_ROUTE_CHARACTERS = /[\\/?#\u0000-\u001F\u007F]/gu;

export function normalizePublicRouteSegment(value, maxCodePoints = 80) {
  const normalized = String(value || "").normalize("NFC").trim().replace(/^@+/u, "");
  const safe = normalized.replace(UNSAFE_ROUTE_CHARACTERS, "");
  return Array.from(safe).slice(0, Math.max(0, maxCodePoints)).join("");
}

export function publicProfilePath(value) {
  const username = normalizePublicRouteSegment(value);
  return username ? `/users/${encodeURIComponent(username)}` : "/users";
}

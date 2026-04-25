import { absoluteApiUrl } from "./apiBase";

export const FALLBACK_AVATAR = "/supernova.png";

export function normalizeAvatarValue(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (
    lower === "default.jpg" ||
    lower === "default-avatar.png" ||
    lower === "/default-avatar.png" ||
    lower.endsWith("/default-avatar.png") ||
    raw === FALLBACK_AVATAR
  ) {
    return "";
  }

  return raw;
}

export function isUploadedAvatarValue(value = "") {
  const raw = normalizeAvatarValue(value);
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return false;
  try {
    return new URL(raw, "https://supernova.local").pathname.startsWith("/uploads/");
  } catch {
    return raw.startsWith("/uploads/") || raw.startsWith("uploads/") || raw.includes("/uploads/");
  }
}

export function avatarDisplayUrl(value = "", fallback = FALLBACK_AVATAR) {
  const raw = normalizeAvatarValue(value);
  if (!raw) return fallback;
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/uploads/")) return absoluteApiUrl(raw);
  if (raw.startsWith("uploads/")) return absoluteApiUrl(`/${raw}`);
  if (raw.startsWith("/")) return raw;
  return absoluteApiUrl(`/uploads/${raw}`);
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
  "youtube-nocookie.com", "www.youtube-nocookie.com",
]);

export function getYouTubeId(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const raw = value.trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const segments = url.pathname.split("/").filter(Boolean);
    let id = "";
    if (["youtu.be", "www.youtu.be"].includes(url.hostname)) id = segments[0] || "";
    else if (YOUTUBE_HOSTS.has(url.hostname)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else if (["embed", "shorts", "live", "v"].includes(segments[0])) id = segments[1] || "";
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

export function youTubeStartSeconds(value) {
  try {
    const url = new URL(value);
    const time = url.searchParams.get("start") || url.searchParams.get("t") || new URLSearchParams(url.hash.slice(1)).get("t") || "";
    if (/^\d+$/.test(time)) return Math.min(Number(time), 86400);
    const parts = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return parts ? Math.min(Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0), 86400) : 0;
  } catch {
    return 0;
  }
}

export function youTubeEmbedUrl(value, origin = "") {
  const id = getYouTubeId(value);
  if (!id) return "";
  const url = new URL(`https://www.youtube.com/embed/${id}`);
  url.search = new URLSearchParams({ autoplay: "1", mute: "1", playsinline: "1", enablejsapi: "1", rel: "0" }).toString();
  if (origin) url.searchParams.set("origin", origin);
  const start = youTubeStartSeconds(value);
  if (start) url.searchParams.set("start", String(start));
  return url.href;
}

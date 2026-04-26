export const BOOKMARK_STORAGE_KEY = "supernova_fe7_bookmarks";
export const BOOKMARKS_CHANGED_EVENT = "supernova:bookmarks-changed";

export function readBookmarkIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeBookmarkIds(ids) {
  if (typeof window === "undefined") return [];
  const uniqueIds = Array.from(new Set((ids || []).map(String).filter(Boolean)));
  try {
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(uniqueIds));
    window.dispatchEvent(new CustomEvent(BOOKMARKS_CHANGED_EVENT, { detail: { ids: uniqueIds } }));
  } catch {
    // Bookmarks are local convenience state; failing closed keeps posting safe.
  }
  return uniqueIds;
}

export function isBookmarkedId(id) {
  if (id === undefined || id === null || id === "") return false;
  return readBookmarkIds().includes(String(id));
}

export function toggleBookmarkId(id) {
  if (id === undefined || id === null || id === "") return false;
  const postId = String(id);
  const current = readBookmarkIds();
  const isSaved = current.includes(postId);
  writeBookmarkIds(isSaved ? current.filter((savedId) => savedId !== postId) : [...current, postId]);
  return !isSaved;
}

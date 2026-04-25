function normalizeBaseUrl(url) {
  return (url || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

function joinApiUrl(baseUrl, path = "") {
  if (!path) return baseUrl;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) return `${baseUrl}/${path}`;
  return `${baseUrl}${path}`;
}

export const API_BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
export const CORE_API_BASE_URL = `${API_BASE_URL}/core`;

export function absoluteApiUrl(path = "") {
  return joinApiUrl(API_BASE_URL, path);
}

export function coreApiUrl(path = "") {
  return joinApiUrl(CORE_API_BASE_URL, path);
}

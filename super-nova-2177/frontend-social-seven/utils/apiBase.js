const LOCAL_API_FALLBACK = "http://127.0.0.1:8000";
const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const PRODUCTION_ENV_MARKERS = [
  process.env.VERCEL_ENV,
  process.env.NEXT_PUBLIC_VERCEL_ENV,
  process.env.SUPERNOVA_ENV,
  process.env.NEXT_PUBLIC_SUPERNOVA_ENV,
  process.env.APP_ENV,
  process.env.NEXT_PUBLIC_APP_ENV,
  process.env.ENV,
  process.env.NEXT_PUBLIC_ENV,
  process.env.RAILWAY_ENVIRONMENT,
];

function isProductionRuntime() {
  return PRODUCTION_ENV_MARKERS.some((value) => ["production", "prod"].includes((value || "").toLowerCase()));
}

function validateProductionApiUrl(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be a valid http(s) URL in production.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_URL must be a valid http(s) URL in production.");
  }

  if (LOCAL_API_HOSTS.has(parsedUrl.hostname)) {
    throw new Error("NEXT_PUBLIC_API_URL must not point to localhost in production.");
  }
}

function normalizeBaseUrl(url) {
  const rawUrl = (url || "").trim();

  if (!rawUrl) {
    if (isProductionRuntime()) {
      throw new Error("NEXT_PUBLIC_API_URL is required in production.");
    }
    return LOCAL_API_FALLBACK;
  }

  const normalizedUrl = rawUrl.replace(/\/+$/, "");
  if (isProductionRuntime()) {
    validateProductionApiUrl(normalizedUrl);
  }

  return normalizedUrl;
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

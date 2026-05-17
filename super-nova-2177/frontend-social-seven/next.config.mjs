import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  return PRODUCTION_ENV_MARKERS.some((value) =>
    ["production", "prod"].includes((value || "").toLowerCase())
  );
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

function normalizeRewriteApiBaseUrl(url) {
  const rawUrl = (url || "").trim();
  if (!rawUrl) {
    if (isProductionRuntime()) {
      throw new Error("NEXT_PUBLIC_API_URL is required in production.");
    }
    return "";
  }

  const normalizedUrl = rawUrl.replace(/\/+$/, "");
  if (isProductionRuntime()) {
    validateProductionApiUrl(normalizedUrl);
  }

  return normalizedUrl;
}

const apiBaseUrl = normalizeRewriteApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    if (!apiBaseUrl) return [];
    return [
      { source: "/.well-known/:path*", destination: `${apiBaseUrl}/.well-known/:path*` },
      { source: "/protocol/:path*", destination: `${apiBaseUrl}/protocol/:path*` },
      { source: "/actors/:path*", destination: `${apiBaseUrl}/actors/:path*` },
      { source: "/u/:path*", destination: `${apiBaseUrl}/u/:path*` },
      { source: "/domain-verification/:path*", destination: `${apiBaseUrl}/domain-verification/:path*` },
    ];
  },
};

export default nextConfig;

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
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
}

export default nextConfig;

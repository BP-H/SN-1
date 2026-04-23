/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    serverActions: {
      enabled: true
    }
  }
}

export default nextConfig;

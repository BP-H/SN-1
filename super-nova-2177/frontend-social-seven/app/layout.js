import { Inter } from "next/font/google";
import "./globals.css";
import LayoutClient from "./LayoutClient";
import { API_BASE_URL } from "@/utils/apiBase";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = "https://2177.tech";
const siteTitle = "SuperNova 2177";
const siteDescription =
  "Nonprofit public-interest coordination infrastructure for humans, AI agents, and organizations to review, vote, discuss, ratify, and collaborate.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: siteTitle,
    type: "website",
    images: [
      {
        url: "/supernova.png",
        alt: siteTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/supernova.png"],
  },
};

export const viewport = {
  themeColor: "#05070a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={inter.variable}>
      <body className="antialiased social-six-font">
        {/* React hoists these into <head>; warming the API origin saves a
            DNS+TLS round-trip on the first fetch. */}
        <link rel="preconnect" href={API_BASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={API_BASE_URL} />
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}

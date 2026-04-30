import "./globals.css";
import LayoutClient from "./LayoutClient";

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

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased social-six-font">
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}

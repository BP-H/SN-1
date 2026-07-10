const siteUrl = "https://2177.tech";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/bookmarks",
        "/bookmarks/",
        "/messages",
        "/messages/",
        "/settings/",
        "/reset-password",
        "/reset-password/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

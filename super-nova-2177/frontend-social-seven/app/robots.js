const siteUrl = "https://2177.tech";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/settings/", "/reset-password", "/reset-password/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

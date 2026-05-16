const siteUrl = "https://2177.tech";

const publicRoutes = ["/", "/about", "/universe", "/for-ai", "/proposals"];

export default function sitemap() {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}

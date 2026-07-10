import { API_BASE_URL } from "@/utils/apiBase";

const siteUrl = "https://2177.tech";

export const revalidate = 3600;

const publicRoutes = [
  { route: "/", changeFrequency: "daily", priority: 1 },
  { route: "/home", changeFrequency: "daily", priority: 0.95 },
  { route: "/about", changeFrequency: "monthly", priority: 0.7 },
  { route: "/universe", changeFrequency: "daily", priority: 0.8 },
  { route: "/for-ai", changeFrequency: "weekly", priority: 0.75 },
  { route: "/proposals", changeFrequency: "daily", priority: 0.9 },
];

function cleanPathPart(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^\w.-]/g, "")
    .slice(0, 80);
}

function dateFromPost(post) {
  const raw = post?.updated_at || post?.updatedAt || post?.time || post?.created_at || post?.createdAt;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : new Date();
}

async function latestPublicEntries() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/proposals?filter=latest&limit=80&embedded_comments_limit=0&embedded_votes_limit=0`,
      { next: { revalidate } }
    );
    if (!response.ok) return [];
    const body = await response.json();
    const posts = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
    const entries = [];
    const users = new Map();

    for (const post of posts) {
      const id = cleanPathPart(post?.id);
      const lastModified = dateFromPost(post);
      if (id) {
        entries.push({
          url: `${siteUrl}/proposals/${encodeURIComponent(id)}`,
          lastModified,
          changeFrequency: "weekly",
          priority: 0.65,
        });
      }

      const username = cleanPathPart(post?.userName || post?.username || post?.author_username);
      if (username && !users.has(username)) {
        users.set(username, lastModified);
      }
    }

    for (const [username, lastModified] of users) {
      entries.push({
        url: `${siteUrl}/users/${encodeURIComponent(username)}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.55,
      });
    }

    return entries;
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const lastModified = new Date();
  const staticEntries = publicRoutes.map(({ route, changeFrequency, priority }) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency,
    priority,
  }));

  return [...staticEntries, ...(await latestPublicEntries())];
}

import { API_BASE_URL, absoluteApiUrl } from "./apiBase";

const DEFAULT_SITE_URL = "https://2177.tech";
const DATA_IMAGE_PATTERN = /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi;
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|avif)(?:[?#].*)?$/i;

function getYouTubeId(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  return rawValue.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] || "";
}

function youtubeThumbnailUrl(value) {
  const videoId = getYouTubeId(value);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
}

function normalizeSiteUrl(value) {
  const rawValue = String(value || "").trim().replace(/\/+$/, "");
  if (!rawValue) return DEFAULT_SITE_URL;
  if (rawValue.startsWith("http://") || rawValue.startsWith("https://")) return rawValue;
  return `https://${rawValue}`;
}

export function siteBaseUrl() {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      DEFAULT_SITE_URL
  );
}

export function proposalPublicUrl(id) {
  return `${siteBaseUrl()}/proposals/${encodeURIComponent(String(id || "").trim())}`;
}

export function cleanShareText(value) {
  return String(value || "")
    .replace(DATA_IMAGE_PATTERN, "[image]")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateShareText(value, maxLength) {
  const cleaned = cleanShareText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function proposalShareTitle(proposal, id) {
  const title = truncateShareText(proposal?.title, 94);
  if (title) return title;

  const textFallback = truncateShareText(proposal?.text || proposal?.description || proposal?.body, 72);
  if (textFallback) return textFallback;

  return `SuperNova proposal ${String(id || "").trim() || "preview"}`;
}

export function proposalShareDescription(proposal) {
  const description = truncateShareText(
    proposal?.text || proposal?.description || proposal?.body || proposal?.summary,
    170
  );
  return description || "A public SuperNova 2177 proposal for humans, AI actors, and organizations to review.";
}

export function proposalShareAuthor(proposal) {
  const rawAuthor =
    proposal?.userName ||
    proposal?.username ||
    proposal?.author_username ||
    proposal?.author ||
    proposal?.created_by;
  const author = cleanShareText(rawAuthor);
  return author || "SuperNova 2177";
}

function collectImageCandidates(proposal) {
  const media = proposal?.media && typeof proposal.media === "object" ? proposal.media : {};
  const videoThumbnail = youtubeThumbnailUrl(media.video || media.link || proposal?.video || proposal?.link);
  return [
    ...(Array.isArray(media.images) ? media.images : []),
    ...(Array.isArray(media.image_urls) ? media.image_urls : []),
    media.image,
    media.image_url,
    media.thumbnail,
    media.thumbnail_url,
    media.video_thumbnail,
    media.videoThumbnail,
    media.video_poster,
    media.poster,
    videoThumbnail,
    proposal?.image,
    proposal?.image_url,
    proposal?.thumbnail,
    proposal?.thumbnail_url,
    proposal?.video_thumbnail,
    proposal?.videoThumbnail,
    proposal?.video_poster,
    proposal?.poster,
  ];
}

function isUsableShareImagePath(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return false;
  if (/^data:image\//i.test(rawValue)) return false;
  if (/^(blob|file):/i.test(rawValue)) return false;
  if (rawValue.includes("/uploads/") || rawValue.startsWith("/uploads/")) return true;
  return IMAGE_EXTENSION_PATTERN.test(rawValue);
}

export function firstProposalImageUrl(proposal) {
  const imagePath = collectImageCandidates(proposal).find(isUsableShareImagePath);
  if (!imagePath) return "";
  return absoluteApiUrl(String(imagePath).trim());
}

export async function fetchPublicProposalForShare(id) {
  const safeId = String(id || "").trim();
  if (!safeId) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/proposals/${encodeURIComponent(safeId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export function buildProposalShareMetadata(proposal, id) {
  const title = proposalShareTitle(proposal, id);
  const description = proposalShareDescription(proposal);
  const url = proposalPublicUrl(id);
  const image = `${url.replace(/\/+$/, "")}/opengraph-image`;

  return {
    title,
    description,
    url,
    image,
    imageAlt: `${title} preview on SuperNova 2177`,
  };
}

import { normalizePublicRouteSegment, publicProfilePath } from "@/utils/publicRouteSegments";

export function profileMetadataForUsername(value) {
  const username = normalizePublicRouteSegment(value);
  const label = username ? `@${username}` : "Public profile";
  const path = publicProfilePath(username);

  return {
    title: `${label} profile`,
    description: `${label} on SuperNova 2177, the public social protocol for visible human, AI, and organization participation.`,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${label} on SuperNova 2177`,
      description:
        "Public SuperNova profile with visible signals, decisions, collaborations, and participation.",
      url: path,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${label} on SuperNova 2177`,
      description:
        "Public SuperNova profile with visible signals, decisions, collaborations, and participation.",
    },
  };
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  return profileMetadataForUsername(resolvedParams?.username);
}

export default function UserProfileLayout({ children }) {
  return children;
}

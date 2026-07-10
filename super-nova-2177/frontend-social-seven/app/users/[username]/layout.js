function cleanUsername(value) {
  return String(value || "")
    .replace(/^@+/, "")
    .replace(/[^\w.-]/g, "")
    .slice(0, 48);
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const username = cleanUsername(resolvedParams?.username);
  const label = username ? `@${username}` : "Public profile";
  const path = username ? `/users/${encodeURIComponent(username)}` : "/users";

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

export default function UserProfileLayout({ children }) {
  return children;
}

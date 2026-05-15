import ProposalClient from "./ProposalClient";
import {
  buildProposalShareMetadata,
  fetchPublicProposalForShare,
} from "@/utils/proposalSharePreview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const proposal = await fetchPublicProposalForShare(id);
  const shareMetadata = buildProposalShareMetadata(proposal, id);
  const openGraphVideos = shareMetadata.video
    ? [
        {
          url: shareMetadata.video,
        },
      ]
    : undefined;

  return {
    title: shareMetadata.title,
    description: shareMetadata.description,
    alternates: {
      canonical: shareMetadata.url,
    },
    openGraph: {
      title: shareMetadata.title,
      description: shareMetadata.description,
      url: shareMetadata.url,
      siteName: "SuperNova 2177",
      type: "article",
      images: [
        {
          url: shareMetadata.image,
          width: 1200,
          height: 630,
          alt: shareMetadata.imageAlt,
        },
      ],
      ...(openGraphVideos ? { videos: openGraphVideos } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: shareMetadata.title,
      description: shareMetadata.description,
      images: [shareMetadata.image],
    },
  };
}

export default async function ProposalPage({ params }) {
  const { id } = await params;
  return <ProposalClient id={id} />;
}

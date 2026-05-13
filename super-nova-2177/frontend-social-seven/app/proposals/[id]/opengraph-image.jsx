import { ImageResponse } from "next/og";
import {
  fetchPublicProposalForShare,
  firstProposalImageUrl,
  proposalShareAuthor,
  proposalShareDescription,
  proposalShareTitle,
} from "@/utils/proposalSharePreview";

export const alt = "SuperNova proposal preview";
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};

function SharePreviewCard({ author, description, imageUrl, title }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #06131f 0%, #16324b 50%, #53364d 100%)",
        color: "#f8fbff",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {imageUrl ? (
        <img
          alt=""
          src={imageUrl}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.86,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(90deg, rgba(2, 8, 16, 0.92) 0%, rgba(5, 14, 26, 0.74) 52%, rgba(5, 14, 26, 0.3) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(0deg, rgba(2, 8, 16, 0.56) 0%, rgba(2, 8, 16, 0.12) 54%, rgba(2, 8, 16, 0.42) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", fontSize: 29, fontWeight: 800 }}>SuperNova 2177</div>
          <div style={{ display: "flex", color: "#c9d8ec", fontSize: 23 }}>{author}</div>
        </div>
        <div
          style={{
            display: "flex",
            border: "1px solid rgba(255, 255, 255, 0.48)",
            borderRadius: 999,
            padding: "12px 18px",
            color: "#f7fbff",
            fontSize: 22,
            background: "rgba(6, 19, 31, 0.54)",
          }}
        >
          Public proposal
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 120,
          bottom: 58,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: title.length > 76 ? 54 : 64,
            fontWeight: 900,
            lineHeight: 1.04,
            maxWidth: 880,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            color: "#dbe7f5",
            fontSize: 29,
            lineHeight: 1.28,
            maxWidth: 820,
          }}
        >
          {description}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 58,
          bottom: 54,
          display: "flex",
          color: "#dce8f6",
          fontSize: 24,
        }}
      >
        2177.tech
      </div>
    </div>
  );
}

export default async function Image({ params }) {
  const { id } = await params;
  const proposal = await fetchPublicProposalForShare(id);
  const title = proposalShareTitle(proposal, id);
  const description = proposalShareDescription(proposal);
  const author = proposalShareAuthor(proposal);
  const imageUrl = firstProposalImageUrl(proposal);

  return new ImageResponse(
    <SharePreviewCard author={author} description={description} imageUrl={imageUrl} title={title} />,
    size
  );
}

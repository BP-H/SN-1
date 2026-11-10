"use client";

import { FaFileAlt, FaLink } from "react-icons/fa";
import MediaGallery from "./MediaGallery";
import PdfPager from "./PdfPager";
import FeedVideoPlayer from "./FeedVideoPlayer";

export default function ProposalMediaBlock({
  displayFile,
  displayImages = [],
  displayImageDimensions = null,
  displayLink,
  displayVideo,
  displayVideoUrl,
  getImageUrl,
  isPdfFile,
  mediaLayout,
  title,
}) {
  return (
    <>
      {displayImages.length > 0 && (
        <MediaGallery
          images={displayImages}
          dimensions={displayImageDimensions}
          layout={mediaLayout}
          title={title}
          getUrl={getImageUrl}
        />
      )}

      {displayVideo && <FeedVideoPlayer key={displayVideo} source={displayVideo} src={displayVideoUrl} title={title} />}

      {displayLink && (
        <div className="flex items-center gap-3 rounded-[0.8rem] bg-[rgba(255,255,255,0.05)] p-4 hover:bg-[rgba(255,255,255,0.08)] transition-colors">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-white shadow-[var(--shadow-blue)]">
            <FaLink className="text-[1.2rem]" />
          </div>
          <div className="min-w-0 flex-1">
            <a href={displayLink} target="_blank" rel="noopener noreferrer"
              className="truncate block text-[0.85rem] font-medium text-[var(--neon-blue)] hover:underline"
              onClick={(event) => event.stopPropagation()}>
              {displayLink}
            </a>
          </div>
        </div>
      )}

      {displayFile && isPdfFile && (
        <div className="mobile-media-bleed">
          <PdfPager src={displayFile} title={`${title || "Post"} PDF`} />
        </div>
      )}

      {displayFile && !isPdfFile && (
        <a
          href={displayFile}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-[var(--blue)] px-3 py-2 text-white shadow-[var(--shadow-blue)]"
        >
          <FaFileAlt className="text-[1.2rem]" />
          <p>View document</p>
        </a>
      )}
    </>
  );
}

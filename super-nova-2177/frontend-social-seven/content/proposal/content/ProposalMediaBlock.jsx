"use client";

import { FaFileAlt, FaLink } from "react-icons/fa";
import MediaGallery from "./MediaGallery";
import PdfPager from "./PdfPager";

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
  onOpenVideo,
  onVideoLoaded,
  title,
  videoEmbedUrl,
  videoLoaded,
  videoOpen,
  videoThumbnail,
  videoThumbnailFallback,
  youtubeId,
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

      {displayVideo && (
        <>
          {youtubeId && !videoOpen ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onOpenVideo?.();
              }}
              className="mobile-media-bleed relative aspect-video w-full overflow-hidden rounded-[1.15rem] bg-[var(--gray)] shadow-sm"
            >
              <img
                src={videoThumbnail}
                alt={title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                onError={(event) => {
                  if (event.currentTarget.src !== videoThumbnailFallback) {
                    event.currentTarget.src = videoThumbnailFallback;
                  }
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,59,48,0.94)] text-[1.4rem] text-white shadow-[0_0_24px_rgba(255,59,48,0.45)]">
                  {"\u25b6"}
                </span>
              </div>
            </button>
          ) : youtubeId ? (
            <>
              {!videoLoaded && (
                <div className="mobile-media-bleed flex h-52 w-full items-center justify-center rounded-[18px] bg-[var(--gray)] shadow-sm">
                  <img src="/spinner.svg" alt="loading" />
                </div>
              )}
              <div className={`mobile-media-bleed aspect-video w-full overflow-hidden rounded-[18px] bg-[var(--gray)] shadow-sm ${videoLoaded ? "" : "hidden"}`}>
                <iframe
                  src={videoEmbedUrl}
                  title="Video"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={onVideoLoaded}
                  className="h-full w-full"
                />
              </div>
            </>
          ) : (
            <div className="mobile-media-bleed aspect-video w-full overflow-hidden rounded-[18px] bg-[var(--gray)] shadow-sm">
              <video
                src={displayVideoUrl}
                controls
                preload="metadata"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </>
      )}

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

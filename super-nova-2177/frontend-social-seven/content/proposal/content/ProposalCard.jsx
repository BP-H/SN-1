"use client";

import { useState } from "react";
import Link from "next/link";
import { FaFileAlt, FaUser, FaBriefcase, FaLink } from "react-icons/fa";
import { BsFillCpuFill } from "react-icons/bs";
import { IoMdArrowRoundBack } from "react-icons/io";
import { FaCommentAlt } from "react-icons/fa";
import { IoMdBookmark } from "react-icons/io";
import { IoIosShare } from "react-icons/io";
import { useUser } from "@/content/profile/UserContext";
import { absoluteApiUrl } from "@/utils/apiBase";
import LikesDeslikes from "./LikesDeslikes";
import DisplayComments from "./DisplayComments";
import InsertComment from "./InsertComment";

/* Species config: icon + colors */
const SPECIES_CONFIG = {
  human: {
    icon: FaUser,
    bg: "bg-[#e8457a]",
    shadow: "shadow-[0_0_10px_rgba(232,69,122,0.35)]",
  },
  company: {
    icon: FaBriefcase,
    bg: "bg-[#4a8fe7]",
    shadow: "shadow-[0_0_10px_rgba(74,143,231,0.3)]",
  },
  ai: {
    icon: BsFillCpuFill,
    bg: "bg-[#9b6dff]",
    shadow: "shadow-[0_0_10px_rgba(155,109,255,0.35)]",
  },
};

function ProposalCard({
  id,
  userName,
  userInitials,
  time,
  title,
  text,
  media = {},
  logo,
  likes,
  dislikes,
  comments = [],
  setErrorMsg,
  setNotify,
  specie,
  isDetailPage = false,
}) {
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState(comments);
  const [readMore, setReadMore] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);

  const speciesConf = SPECIES_CONFIG[specie] || SPECIES_CONFIG.human;
  const SpeciesIcon = speciesConf.icon;

  const { userData } = useUser();

  const getFullImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return absoluteApiUrl(url);
  };

  const getYouTubeId = (url) => {
    if (!url) return "";
    const regExp =
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return url.match(regExp)?.[1] || "";
  };

  const getEmbedUrl = (url) => {
    if (!url) return "";
    try {
      if (url.includes("youtube.com/embed/")) return url;
      const videoId = getYouTubeId(url);
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      return url;
    } catch {
      return url;
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/proposals/${id || ""}`;
    const shareText = title ? `Check out: ${title}` : "Check out this proposal";
    if (navigator.share) {
      try { await navigator.share({ title: shareText, url }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const displayVideo = media.video || (getYouTubeId(media.link) ? media.link : null);
  const displayLink = displayVideo === media.link ? null : media.link;

  const youtubeId = getYouTubeId(displayVideo);
  const videoThumbnail = youtubeId
    ? `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`
    : "";
  const videoThumbnailFallback = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : "";

  return (
    <div
      className={`bgWhiteTrue social-panel-compact mx-auto flex w-full flex-col gap-4 rounded-[1.75rem] p-5 text-[var(--text-black)] shadow-sm ${
        isDetailPage ? "" : "hover:shadow-md"
      }`}
    >
      {/* ── Header: avatar · name · time · species icon ── */}
      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="shrink-0">
          {logo ? (
            <img
              src={getFullImageUrl(logo)}
              alt="user avatar"
              className="h-10 w-10 rounded-full object-cover shadow-md"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gray)] text-[0.78rem] font-semibold shadow-sm">
              {userInitials}
            </div>
          )}
        </div>
        <div className="min-w-0 truncate text-[0.9rem]">
          <span className="font-semibold text-[var(--text-black)]">{userName}</span>
          <span className="mx-2 text-[var(--text-gray-light)]">•</span>
          <span className="text-[var(--text-gray-light)]">{time}</span>
        </div>

        {/* Species icon badge — replaces text label */}
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.8rem] text-white ${speciesConf.bg} ${speciesConf.shadow}`}
          title={specie === "company" ? "ORG" : specie === "ai" ? "AI" : "Human"}
        >
          <SpeciesIcon />
        </span>
      </div>

      {/* ── Post content (text + media) ── */}
      <div className="flex w-full min-w-0 flex-col gap-3">
        <Link href={`/proposals/${id}`} className="flex min-w-0 flex-col gap-3">
          {text && (
            <div className="flex min-w-0 flex-col gap-1">
              <p
                className="post-text text-[0.94rem] leading-6 break-words text-[var(--transparent-black)]"
                style={readMore ? undefined : { maxHeight: "7.5rem", overflow: "hidden" }}
              >
                {text}
              </p>
              {(text.length > 220 || (text.match(/\n/g) || []).length >= 4) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setReadMore((v) => !v); }}
                  className="w-fit text-[0.82rem] font-medium text-[var(--neon-blue)]"
                >
                  {readMore ? "Show Less" : "Read More"}
                </button>
              )}
            </div>
          )}

          {media.image && (
            <>
              {!imageLoaded && (
                <div className="flex h-52 w-full items-center justify-center rounded-[18px] bg-[var(--gray)] shadow-sm">
                  <img src="./spinner.svg" alt="loading" />
                </div>
              )}
              <div
                className={`flex w-full flex-col items-center justify-center overflow-hidden rounded-[18px] shadow-sm ${
                  !imageZoom
                    ? "bg-[var(--gray)]"
                    : "fixed left-0 top-0 z-[9999] h-screen w-screen rounded-none bg-black p-5"
                }`}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setImageZoom(true); }}
              >
                {imageZoom && (
                  <IoMdArrowRoundBack
                    className="absolute left-5 top-5 cursor-pointer text-3xl text-white"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setImageZoom(false); }}
                  />
                )}
                <img
                  src={getFullImageUrl(media.image)}
                  alt={title}
                  className={`max-h-[32rem] w-full object-cover ${imageLoaded ? "" : "hidden"}`}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </>
          )}

          {displayVideo && (
            <>
              {youtubeId && !videoOpen ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setVideoOpen(true); }}
                  className="relative aspect-video w-full overflow-hidden rounded-[1.15rem] bg-[var(--gray)] shadow-sm"
                >
                  <img
                    src={videoThumbnail}
                    alt={title}
                    className="h-full w-full object-cover"
                    onError={(e) => { if (e.currentTarget.src !== videoThumbnailFallback) e.currentTarget.src = videoThumbnailFallback; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,59,48,0.94)] text-[1.4rem] text-white shadow-[0_0_24px_rgba(255,59,48,0.45)]">▶</span>
                  </div>
                </button>
              ) : (
                <>
                  {!videoLoaded && (
                    <div className="flex h-52 w-full items-center justify-center rounded-[18px] bg-[var(--gray)] shadow-sm">
                      <img src="./spinner.svg" alt="loading" />
                    </div>
                  )}
                  <div className={`aspect-video w-full overflow-hidden rounded-[18px] bg-[var(--gray)] shadow-sm ${videoLoaded ? "" : "hidden"}`}>
                    <iframe
                      src={getEmbedUrl(displayVideo)}
                      title="Video"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      onLoad={() => setVideoLoaded(true)}
                      className="h-full w-full"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </Link>

        {displayLink && (
          <div className="flex items-center gap-3 rounded-[0.8rem] bg-[rgba(255,255,255,0.05)] p-4 hover:bg-[rgba(255,255,255,0.08)] transition-colors">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-white shadow-[var(--shadow-blue)]">
              <FaLink className="text-[1.2rem]" />
            </div>
            <div className="min-w-0 flex-1">
              <a href={displayLink} target="_blank" rel="noopener noreferrer"
                className="truncate block text-[0.85rem] font-medium text-[var(--neon-blue)] hover:underline"
                onClick={(e) => e.stopPropagation()}>
                {displayLink}
              </a>
            </div>
          </div>
        )}

        {media.file && (
          <span
            onClick={(e) => { e.stopPropagation(); window.open(getFullImageUrl(media.file), "_blank"); }}
            className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-[var(--blue)] px-3 py-2 text-white shadow-[var(--shadow-blue)]"
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.open(getFullImageUrl(media.file), "_blank"); } }}
          >
            <FaFileAlt className="text-[1.2rem]" />
            <p>Download file</p>
          </span>
        )}

        {/* ── Unified action bar: [voting] ··· [comment · bookmark · share] ── */}
        <div
          className="flex w-full items-center gap-2 rounded-full bg-[rgba(255,255,255,0.04)] px-2.5 py-1.5"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        >
          {/* Left: voting controls */}
          <div className="min-w-0 flex-1">
            <LikesDeslikes
              setErrorMsg={setErrorMsg}
              initialLikes={likes.length}
              initialDislikes={dislikes.length}
              initialLikesList={likes}
              initialDislikesList={dislikes}
              initialClicked={
                likes.some((v) => v.voter === userData?.name)
                  ? "like"
                  : dislikes.some((v) => v.voter === userData?.name)
                  ? "dislike"
                  : null
              }
              proposalId={id}
            />
          </div>

          {/* Right: comment · bookmark · share */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Comment toggle */}
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-2 transition-colors ${
                showComments
                  ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                  : "bg-[rgba(255,255,255,0.06)] text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.12)]"
              }`}
            >
              <FaCommentAlt className="text-[0.72rem]" />
              <span className="text-[0.75rem] font-medium">{localComments.length}</span>
            </button>

            {/* Bookmark */}
            <button
              type="button"
              onClick={() => setBookmarked((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                bookmarked
                  ? "bg-[rgba(255,255,255,0.14)] text-[var(--blue)]"
                  : "bg-[rgba(255,255,255,0.06)] text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.12)]"
              }`}
              title={bookmarked ? "Remove bookmark" : "Bookmark"}
            >
              <IoMdBookmark className="text-[0.9rem]" />
            </button>

            {/* Share */}
            <button
              type="button"
              onClick={handleShare}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                copied
                  ? "bg-[rgba(255,255,255,0.14)] text-green-400"
                  : "bg-[rgba(255,255,255,0.06)] text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.12)]"
              }`}
              title={copied ? "Link copied!" : "Share"}
            >
              <IoIosShare className="text-[0.95rem]" />
            </button>
          </div>
        </div>

        {/* ── Comments section ── */}
        {(showComments || isDetailPage) && (
          <div className="flex min-w-0 flex-col gap-2 rounded-[15px] bg-[rgba(255,255,255,0.03)] p-2">
            <div onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
              <InsertComment
                setErrorMsg={setErrorMsg}
                setNotify={setNotify}
                proposalId={id}
                setLocalComments={setLocalComments}
              />
            </div>
            <div className="hide-scrollbar flex max-h-[18rem] min-w-0 flex-col gap-2 overflow-y-auto pr-1">
              {localComments.map((comment, index) => (
                <DisplayComments
                  key={index}
                  name={comment.user}
                  image={comment.user_img}
                  comment={comment.comment}
                  userSpecie={comment.species}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProposalCard;

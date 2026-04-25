"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaFileAlt, FaLink } from "react-icons/fa";
import { FaCommentAlt } from "react-icons/fa";
import { IoMdBookmark } from "react-icons/io";
import { IoIosShare } from "react-icons/io";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/content/profile/UserContext";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";
import {
  IoCheckmark,
  IoClose,
  IoCreateOutline,
  IoEllipsisHorizontal,
  IoPersonAddOutline,
  IoPersonRemoveOutline,
  IoChatbubbleOutline,
  IoTrashOutline,
} from "react-icons/io5";
import LikesDeslikes from "./LikesDeslikes";
import DisplayComments from "./DisplayComments";
import InsertComment from "./InsertComment";
import MediaGallery from "./MediaGallery";
import PdfPager from "./PdfPager";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";

function ProposalCard({
  id,
  userName,
  time,
  title,
  text,
  media = {},
  logo,
  likes = [],
  dislikes = [],
  comments = [],
  setErrorMsg,
  setNotify,
  isDetailPage = false,
}) {
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState(comments);
  const [localText, setLocalText] = useState(text || "");
  const [editText, setEditText] = useState(text || "");
  const [readMore, setReadMore] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followingAuthor, setFollowingAuthor] = useState(false);
  const [localLogo, setLocalLogo] = useState(logo || "");
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const { userData, defaultAvatar } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isOwner = Boolean(userName && userData?.name && userName.toLowerCase() === userData.name.toLowerCase());
  const displayLogo = isOwner && normalizeAvatarValue(userData?.avatar) ? userData.avatar : localLogo;
  const displayAvatar = avatarDisplayUrl(displayLogo, defaultAvatar);

  const getFullImageUrl = (url) => {
    const value = normalizeAvatarValue(url);
    if (!value) return null;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    return absoluteApiUrl(value);
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

  const refreshFeeds = () => {
    queryClient.invalidateQueries({ queryKey: ["home-feed"] });
    queryClient.invalidateQueries({ queryKey: ["proposals"] });
    queryClient.invalidateQueries({ queryKey: ["user-posts"] });
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) {
      setErrorMsg?.(["Post text cannot be empty."]);
      return;
    }
    setOwnerBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editText.trim().replace(/\s+/g, " ").slice(0, 70),
          body: editText.trim(),
          author: userData.name,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || "Unable to edit post.");
      setLocalText(payload.text || editText.trim());
      setEditing(false);
      setMenuOpen(false);
      setNotify?.(["Post updated."]);
      refreshFeeds();
    } catch (error) {
      setErrorMsg?.([error.message || "Unable to edit post."]);
    } finally {
      setOwnerBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner || !window.confirm("Delete this post?")) return;
    setOwnerBusy(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/proposals/${encodeURIComponent(id)}?author=${encodeURIComponent(userData.name)}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || "Unable to delete post.");
      setDeleted(true);
      setNotify?.(["Post deleted."]);
      refreshFeeds();
    } catch (error) {
      setErrorMsg?.([error.message || "Unable to delete post."]);
    } finally {
      setOwnerBusy(false);
    }
  };

  const handleMessageAuthor = () => {
    if (!userData?.name) {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
      return;
    }
    if (!userName || isOwner) return;
    setMenuOpen(false);
    router.push(`/messages?to=${encodeURIComponent(userName)}`);
  };

  const handleToggleFollow = async () => {
    if (!userData?.name) {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
      return;
    }
    if (!userName || isOwner || followBusy) return;
    setFollowBusy(true);
    try {
      const response = await fetch(
        followingAuthor
          ? `${API_BASE_URL}/follows?follower=${encodeURIComponent(userData.name)}&target=${encodeURIComponent(userName)}`
          : `${API_BASE_URL}/follows`,
        {
          method: followingAuthor ? "DELETE" : "POST",
          headers: followingAuthor ? undefined : { "Content-Type": "application/json" },
          body: followingAuthor
            ? undefined
            : JSON.stringify({ follower: userData.name, target: userName }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || "Follow action failed.");
      setFollowingAuthor(Boolean(payload.following));
      setNotify?.([payload.following ? `Following ${userName}.` : `Unfollowed ${userName}.`]);
    } catch (error) {
      setErrorMsg?.([error.message || "Follow action failed."]);
    } finally {
      setFollowBusy(false);
      setMenuOpen(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!commentId || !userData?.name || deletingCommentId) return;
    setDeletingCommentId(commentId);
    try {
      const response = await fetch(
        `${API_BASE_URL}/comments/${encodeURIComponent(commentId)}?user=${encodeURIComponent(userData.name)}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || "Unable to delete comment.");
      setLocalComments((prevComments) =>
        prevComments.filter((comment) => String(comment.id || "") !== String(commentId))
      );
      setNotify?.(["Comment deleted."]);
      refreshFeeds();
    } catch (error) {
      setErrorMsg?.([error.message || "Unable to delete comment."]);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const displayVideo = media.video || (getYouTubeId(media.link) ? media.link : null);
  const displayLink = displayVideo === media.link ? null : media.link;
  const displayImages =
    Array.isArray(media.images) && media.images.length > 0
      ? media.images
      : media.image
      ? [media.image]
      : [];
  const displayFile = media.file ? getFullImageUrl(media.file) : "";
  const isPdfFile = /\.pdf(?:$|\?)/i.test(displayFile || "");
  const mediaLayout = media.layout === "grid" ? "grid" : "carousel";
  const detailHref = id !== undefined && id !== null && id !== "" ? `/proposals/${encodeURIComponent(id)}` : "/proposals";
  const userHref = userName ? `/users/${encodeURIComponent(userName)}` : "/profile";
  const userVote = likes.some((v) => v.voter === userData?.name)
    ? "like"
    : dislikes.some((v) => v.voter === userData?.name)
    ? "dislike"
    : "";

  const youtubeId = getYouTubeId(displayVideo);
  const videoThumbnail = youtubeId
    ? `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`
    : "";
  const videoThumbnailFallback = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : "";

  useEffect(() => {
    const handlePostAction = (event) => {
      const detail = event.detail || {};
      if (String(detail.id) !== String(id)) return;
      if (detail.action === "comment" || detail.action === "engage") {
        setShowComments(true);
      }
      if (detail.action === "comment-posted" && detail.comment) {
        setShowComments(true);
        setLocalComments((prevComments) => [...prevComments, detail.comment]);
      }
    };
    window.addEventListener("supernova:post-action", handlePostAction);
    return () => window.removeEventListener("supernova:post-action", handlePostAction);
  }, [id]);

  useEffect(() => {
    setLocalText(text || "");
    setEditText(text || "");
  }, [id, text]);

  useEffect(() => {
    setLocalLogo(logo || "");
  }, [id, logo]);

  useEffect(() => {
    if (!menuOpen || isOwner || !userData?.name || !userName) return undefined;
    let cancelled = false;
    fetch(
      `${API_BASE_URL}/follows/status?follower=${encodeURIComponent(userData.name)}&target=${encodeURIComponent(userName)}`
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload) setFollowingAuthor(Boolean(payload.following));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOwner, menuOpen, userData?.name, userName]);

  useEffect(() => {
    const handleAvatarUpdate = (event) => {
      const detail = event.detail || {};
      if (!detail.username || !userName) return;
      if (String(detail.username).toLowerCase() !== String(userName).toLowerCase()) return;
      setLocalLogo(detail.avatar || "");
      setLocalComments((prevComments) =>
        prevComments.map((comment) =>
          String(comment.user || "").toLowerCase() === String(userName).toLowerCase()
            ? { ...comment, user_img: detail.avatar || "" }
            : comment
        )
      );
    };
    window.addEventListener("supernova:profile-avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("supernova:profile-avatar-updated", handleAvatarUpdate);
  }, [userName]);

  if (deleted) return null;

  return (
    <div
      data-proposal-card
      data-proposal-id={id}
      data-proposal-title={(title || localText || "").slice(0, 180)}
      data-proposal-author={userName || ""}
      data-proposal-text={(localText || title || "").slice(0, 360)}
      data-proposal-user-vote={userVote}
      className={`mobile-post-card bgWhiteTrue social-panel-compact relative mx-auto flex w-full flex-col gap-4 rounded-[1.75rem] p-5 text-[var(--text-black)] shadow-sm ${
        isDetailPage ? "" : "hover:shadow-md"
      }`}
    >
      {/* Header: avatar, name, time, options */}
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <Link href={userHref} className="flex min-w-0 items-center gap-3">
          <div className="shrink-0">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="user avatar"
                onError={(event) => {
                  event.currentTarget.src = defaultAvatar;
                }}
                className="h-10 w-10 rounded-full object-cover shadow-md"
              />
            ) : (
              <img
                src={defaultAvatar}
                alt="user avatar"
                className="h-10 w-10 rounded-full object-cover shadow-md"
              />
            )}
          </div>
          <div className="min-w-0 truncate text-[0.9rem]">
            <span className="font-semibold text-[var(--text-black)]">{userName}</span>
            <span className="mx-2 text-[var(--text-gray-light)]">•</span>
            <span className="text-[var(--text-gray-light)]">{time}</span>
          </div>
        </Link>

        {/* Species icon badge — replaces text label */}
        <div className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenuOpen((value) => !value);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-gray-light)] hover:bg-white/[0.07]"
            aria-label="Post options"
          >
            <IoEllipsisHorizontal />
          </button>
          {menuOpen && (
            <div className="proposal-options-menu absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-[0.9rem] border border-[var(--horizontal-line)] bg-[rgba(10,13,19,0.96)] p-1 text-[0.76rem] shadow-[var(--shadow)] backdrop-blur-xl">
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditText(localText || "");
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07]"
                  >
                    <IoCreateOutline /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={ownerBusy}
                    className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left text-[var(--pink)] hover:bg-white/[0.07] disabled:opacity-50"
                  >
                    <IoTrashOutline /> Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleMessageAuthor}
                    className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07]"
                  >
                    <IoChatbubbleOutline /> Message
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    disabled={followBusy}
                    className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left hover:bg-white/[0.07] disabled:opacity-50"
                  >
                    {followingAuthor ? <IoPersonRemoveOutline /> : <IoPersonAddOutline />}
                    {followingAuthor ? "Unfollow" : "Follow"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Post content (text + media) ── */}
      <div className="flex w-full min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-3">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                className="composer-textarea min-h-28 resize-y rounded-[1rem] border border-[var(--horizontal-line)] bg-white/[0.055] px-3 py-3 text-[0.92rem] outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditText(localText || "");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-[var(--text-gray-light)]"
                  aria-label="Cancel edit"
                >
                  <IoClose />
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={ownerBusy}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)] disabled:opacity-50"
                  aria-label="Save edit"
                >
                  <IoCheckmark />
                </button>
              </div>
            </div>
          ) : localText && (
            <div className="flex min-w-0 flex-col gap-1">
              <Link href={detailHref} className="block min-w-0">
                <p
                  className="post-text text-[0.94rem] leading-6 break-words text-[var(--transparent-black)]"
                  style={readMore ? undefined : { maxHeight: "7.5rem", overflow: "hidden" }}
                >
                  {localText}
                </p>
              </Link>
              {(localText.length > 220 || (localText.match(/\n/g) || []).length >= 4) && (
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

          {displayImages.length > 0 && (
            <MediaGallery
              images={displayImages}
              layout={mediaLayout}
              title={title}
              getUrl={getFullImageUrl}
            />
          )}

          {displayVideo && (
            <>
              {youtubeId && !videoOpen ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setVideoOpen(true); }}
                  className="mobile-media-bleed relative aspect-video w-full overflow-hidden rounded-[1.15rem] bg-[var(--gray)] shadow-sm"
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
              ) : youtubeId ? (
                <>
                  {!videoLoaded && (
                    <div className="mobile-media-bleed flex h-52 w-full items-center justify-center rounded-[18px] bg-[var(--gray)] shadow-sm">
                      <img src="./spinner.svg" alt="loading" />
                    </div>
                  )}
                  <div className={`mobile-media-bleed aspect-video w-full overflow-hidden rounded-[18px] bg-[var(--gray)] shadow-sm ${videoLoaded ? "" : "hidden"}`}>
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
              ) : (
                <div className="mobile-media-bleed aspect-video w-full overflow-hidden rounded-[18px] bg-[var(--gray)] shadow-sm">
                  <video
                    src={getFullImageUrl(displayVideo)}
                    controls
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </>
          )}
        </div>

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
            onClick={(e) => e.stopPropagation()}
            className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-[var(--blue)] px-3 py-2 text-white shadow-[var(--shadow-blue)]"
          >
            <FaFileAlt className="text-[1.2rem]" />
            <p>View document</p>
          </a>
        )}

        {/* ── Unified action bar: [voting] ··· [comment · bookmark · share] ── */}
        <div
          className="mt-0.5 flex w-full items-center gap-2 rounded-[0.8rem] bg-[rgba(255,255,255,0.026)] px-1.5 py-1.5"
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
              initialClicked={userVote || null}
              proposalId={id}
            />
          </div>

          {/* Right: comment · bookmark · share */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Comment toggle */}
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-2 transition-colors ${
                showComments
                  ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                  : "text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
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
                  ? "bg-[rgba(255,255,255,0.12)] text-[var(--blue)]"
                  : "text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
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
                  ? "bg-[rgba(255,255,255,0.12)] text-green-400"
                  : "text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
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
              {localComments.map((comment, index) => {
                const commentId = comment.id ?? "";
                const isCommentAuthor = Boolean(
                  comment.user &&
                    userData?.name &&
                    String(comment.user).toLowerCase() === String(userData.name).toLowerCase()
                );
                const canDeleteComment = Boolean(commentId && (isOwner || isCommentAuthor));
                return (
                  <DisplayComments
                    key={commentId || `${comment.user || "comment"}-${index}`}
                    name={comment.user}
                    image={comment.user_img}
                    comment={comment.comment}
                    userSpecie={comment.species}
                    canDelete={canDeleteComment}
                    deleting={String(deletingCommentId || "") === String(commentId)}
                    onDelete={() => handleDeleteComment(commentId)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProposalCard;

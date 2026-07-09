"use client";

import { FaCommentAlt, FaLink, FaShare } from "react-icons/fa";
import { IoChatbubbleOutline } from "react-icons/io5";
import LikesDeslikes from "./LikesDeslikes";

export default function ProposalActionBar({
  aiReviewButton,
  commentCount = 0,
  copied,
  dislikes = [],
  likes = [],
  likeCount = null,
  dislikeCount = null,
  onMessageShare,
  onShareLink,
  onToggleComments,
  onToggleShareMenu,
  proposalId,
  setErrorMsg,
  shareMenuOpen,
  shareMenuRef,
  showComments,
  userVote,
  votingClosed = false,
}) {
  return (
    <div
      className="post-action-bar mt-0.5 flex w-full items-center gap-2 rounded-[0.8rem] px-1.5 py-1.5"
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      <div className="min-w-0 flex-1">
        <LikesDeslikes
          setErrorMsg={setErrorMsg}
          initialLikes={Number.isFinite(Number(likeCount)) ? Number(likeCount) : likes.length}
          initialDislikes={Number.isFinite(Number(dislikeCount)) ? Number(dislikeCount) : dislikes.length}
          initialLikesList={likes}
          initialDislikesList={dislikes}
          initialClicked={userVote || null}
          proposalId={proposalId}
          votingClosed={votingClosed}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {aiReviewButton}
        <button
          type="button"
          onClick={onToggleComments}
          className={`flex h-8 items-center gap-1.5 rounded-full px-2 transition-colors ${
            showComments
              ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
              : "text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
          }`}
        >
          <FaCommentAlt className="text-[0.72rem]" />
          <span className="text-[0.75rem] font-medium">{commentCount}</span>
        </button>

        <div ref={shareMenuRef} className="relative">
          <button
            type="button"
            onClick={onToggleShareMenu}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              copied || shareMenuOpen
                ? "bg-[rgba(255,255,255,0.12)] text-[var(--pink)]"
                : "text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
            }`}
            title={copied ? "Link copied!" : "Share"}
            aria-label="Share"
            aria-haspopup="menu"
            aria-expanded={shareMenuOpen}
          >
            <FaShare className="text-[0.78rem]" />
          </button>
          {shareMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-10 right-0 z-30 w-40 overflow-hidden rounded-[0.9rem] border border-[var(--horizontal-line)] bg-[var(--surface-strong)] p-1.5 text-[0.78rem] font-semibold text-[var(--text-black)] shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={onMessageShare}
                className="flex w-full items-center gap-2 rounded-[0.7rem] px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.08)]"
              >
                <IoChatbubbleOutline className="text-[0.95rem] text-[var(--pink)]" />
                Send in DM
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={onShareLink}
                className="flex w-full items-center gap-2 rounded-[0.7rem] px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.08)]"
              >
                <FaLink className="text-[0.78rem] text-[var(--pink)]" />
                {copied ? "Copied" : "Share link"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

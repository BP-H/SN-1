"use client";
import { useState, useCallback } from "react";
import { IoMdBookmark } from "react-icons/io";
import { IoIosShare } from "react-icons/io";

function BookShare({ proposalId, title }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleBookmark = useCallback(() => {
    setBookmarked((prev) => !prev);
  }, []);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/proposals/${proposalId || ""}`;
    const shareText = title ? `Check out: ${title}` : "Check out this proposal";

    // Use Web Share API on mobile if available
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [proposalId, title]);

  return (
    <div className="flex w-fit items-center gap-1 rounded-full bg-[var(--gray)] px-1 py-1 text-white shadow-md">
      <button
        type="button"
        onClick={handleBookmark}
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          bookmarked
            ? "bg-[rgba(255,255,255,0.16)] text-[var(--blue)] [filter:drop-shadow(0_0_1px_var(--blue))]"
            : "bg-[rgba(255,255,255,0.08)]"
        }`}
        title={bookmarked ? "Remove bookmark" : "Bookmark"}
      >
        <IoMdBookmark size={20} />
      </button>
      <button
        type="button"
        onClick={handleShare}
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] ${
          copied ? "text-green-400" : "text-white"
        }`}
        title={copied ? "Link copied!" : "Share"}
      >
        <IoIosShare size={20} />
      </button>
    </div>
  );
}

export default BookShare;

"use client"
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
    <div
      className="flex text-[0.6em] bg-[var(--gray)] text-white shadow-md w-fit gap-2 cursor-pointer rounded-full px-1 py-1 items-center justify-between"
    >
      <button
        onClick={handleBookmark}
        className={`flex items-center justify-center gap-1 rounded-full py-0 h-[30px] w-[30px] cursor-pointer ${
          bookmarked ? "text-[var(--blue)] [filter:drop-shadow(0_0_1px_var(--blue))] bg-[var(--transparent-gray)]" : "bg-[var(--transparent-gray)]"
        }`}
        title={bookmarked ? "Remove bookmark" : "Bookmark"}
      >
        <IoMdBookmark size={20} />
      </button>
      <button
        onClick={handleShare}
        className={`flex items-center justify-center gap-1 rounded-full py-0 h-[30px] w-[30px] cursor-pointer bg-[var(--transparent-gray)] ${
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
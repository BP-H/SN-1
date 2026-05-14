"use client";

import {
  IoDocumentTextOutline,
  IoImageOutline,
  IoSend,
  IoSparklesOutline,
  IoVideocamOutline,
} from "react-icons/io5";

export default function CollapsedComposerBar({
  avatarSrc = "",
  avatarFallback = "SN",
  avatarStyle,
  defaultAvatar = "",
  prompt = "Post, propose, or ask AI...",
  onOpen,
  onImage,
  onVideo,
  onFile,
  onAi,
}) {
  const avatarInitials = String(avatarFallback || "SN").slice(0, 2).toUpperCase();

  return (
    <div className="composer-collapsed-bar">
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt="profile"
          onError={(event) => {
            if (defaultAvatar) event.currentTarget.src = defaultAvatar;
          }}
          className="composer-collapsed-avatar rounded-full border object-cover"
          style={avatarStyle}
        />
      ) : (
        <div
          className="composer-collapsed-avatar flex items-center justify-center rounded-full border bgGray text-[0.72rem] font-semibold"
          style={avatarStyle}
        >
          {avatarInitials}
        </div>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="composer-collapsed-prompt"
      >
        {prompt}
      </button>

      <div className="composer-collapsed-actions text-[var(--text-gray-light)]">
        <button type="button" onClick={onImage} className="composer-icon-button composer-collapsed-action" aria-label="Add media">
          <IoImageOutline className="text-[1rem]" />
        </button>
        <button type="button" onClick={onVideo} className="composer-icon-button composer-collapsed-action" aria-label="Add video">
          <IoVideocamOutline className="text-[1rem]" />
        </button>
        <button type="button" onClick={onFile} className="composer-icon-button composer-collapsed-action" aria-label="Add document">
          <IoDocumentTextOutline className="text-[1rem]" />
        </button>
        <button type="button" onClick={onAi} className="composer-icon-button composer-collapsed-action text-[var(--pink)]" aria-label="AI post" title="AI post">
          <IoSparklesOutline className="text-[1rem]" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="composer-collapsed-send"
          aria-label="Post"
          title="Post"
        >
          <IoSend className="text-[1rem]" />
        </button>
      </div>
    </div>
  );
}

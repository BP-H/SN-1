"use client";

import {
  IoDocumentTextOutline,
  IoImageOutline,
  IoSend,
  IoSparklesOutline,
} from "react-icons/io5";
import { useI18n } from "@/content/i18n/LocaleContext";

export default function CollapsedComposerBar({
  avatarSrc = "",
  avatarFallback = "SN",
  avatarStyle,
  defaultAvatar = "",
  prompt = "",
  onOpen,
  onMedia,
  onFile,
  onAi,
}) {
  const { t } = useI18n();
  const avatarInitials = String(avatarFallback || "SN").slice(0, 2).toUpperCase();
  const promptLabel = prompt || t("composer.postPrompt");

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
        {promptLabel}
      </button>

      <div className="composer-collapsed-actions text-[var(--text-gray-light)]">
        <button type="button" onClick={onMedia} className="composer-icon-button composer-collapsed-action" aria-label={t("composer.addMedia")}>
          <IoImageOutline className="text-[1rem]" />
        </button>
        <button type="button" onClick={onFile} className="composer-icon-button composer-collapsed-action" aria-label={t("composer.addDocument")}>
          <IoDocumentTextOutline className="text-[1rem]" />
        </button>
        <button type="button" onClick={onAi} className="composer-icon-button composer-collapsed-action text-[var(--pink)]" aria-label={t("composer.aiPost")} title={t("composer.aiPost")}>
          <IoSparklesOutline className="text-[1rem]" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="composer-collapsed-send"
          aria-label={t("composer.post")}
          title={t("composer.post")}
        >
          <IoSend className="text-[1rem]" />
        </button>
      </div>
    </div>
  );
}

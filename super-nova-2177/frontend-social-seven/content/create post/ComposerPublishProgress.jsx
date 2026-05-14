"use client";

import { IoCloudUploadOutline, IoCheckmarkCircleOutline } from "react-icons/io5";

export default function ComposerPublishProgress({ progress, hasMedia = false, collabCount = 0 }) {
  const percent = Math.max(8, Math.min(100, Number(progress?.percent) || 12));
  const label = progress?.label || (hasMedia ? "Uploading media" : "Posting");
  const detail =
    progress?.detail ||
    "Keep this tab open while SuperNova finishes publishing your post.";

  return (
    <div
      className="composer-publish-progress rounded-[1.1rem] border border-[var(--horizontal-line)] px-4 py-4 text-[var(--text-black)]"
      data-progress-percent={Math.round(percent)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]">
          {percent >= 100 ? (
            <IoCheckmarkCircleOutline className="text-[1.35rem]" />
          ) : (
            <IoCloudUploadOutline className="text-[1.35rem]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.92rem] font-black">{label}</p>
          <p className="mt-0.5 text-[0.74rem] font-semibold leading-5 text-[var(--text-gray-light)]">
            {detail}
          </p>
        </div>
        <span className="shrink-0 text-[0.78rem] font-black tabular-nums text-[var(--pink)]">
          {Math.round(percent)}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <div
          className="composer-publish-progress-fill h-full rounded-full bg-[var(--pink)] shadow-[var(--shadow-pink)] transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.68rem] font-bold text-[var(--text-gray-light)]">
        <span>{hasMedia ? "Media included" : "Text post"}</span>
        {collabCount > 0 && <span>{collabCount} collab invite{collabCount === 1 ? "" : "s"}</span>}
      </div>
    </div>
  );
}

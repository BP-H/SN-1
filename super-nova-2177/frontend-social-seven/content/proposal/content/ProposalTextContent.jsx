"use client";

import LinkifiedText from "@/utils/linkify";

export default function ProposalTextContent({
  text,
  readMore,
  onToggleReadMore,
  verifiedMentions = [],
}) {
  if (!text) return null;

  const shouldShowReadMore = text.length > 220 || (text.match(/\n/g) || []).length >= 4;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p
        className="post-text text-[0.94rem] leading-6 break-words text-[var(--transparent-black)]"
        style={readMore ? undefined : { maxHeight: "7.5rem", overflow: "hidden" }}
      >
        <LinkifiedText text={text} enableMentions validMentionUsernames={verifiedMentions} />
      </p>
      {shouldShowReadMore && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onToggleReadMore?.();
          }}
          className="w-fit text-[0.82rem] font-medium text-[var(--neon-blue)]"
        >
          {readMore ? "Show Less" : "Read More"}
        </button>
      )}
    </div>
  );
}

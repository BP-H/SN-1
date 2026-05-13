"use client";

export default function AssistantCommentPanel({
  commentInputRef,
  mentionAutocompleteNode = null,
  onCancel,
  onChange,
  onClick,
  onKeyDown,
  onKeyUp,
  onSubmit,
  submitDisabled = false,
  submitting = false,
  value = "",
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="relative">
        <textarea
          ref={commentInputRef}
          value={value}
          onChange={onChange}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          placeholder="Write a comment..."
          className="ai-cursor-field min-h-24 w-full rounded-[0.85rem] px-3 py-2 text-[0.84rem] outline-none"
        />
        {mentionAutocompleteNode}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="ai-cursor-secondary-button rounded-full px-3 py-2 text-[0.76rem] font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="rounded-full bg-[var(--pink)] px-4 py-2 text-[0.76rem] font-semibold text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}

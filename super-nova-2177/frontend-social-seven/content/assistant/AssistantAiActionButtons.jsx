"use client";

import { IoCheckmark, IoClose } from "react-icons/io5";

export default function AssistantAiActionButtons({
  canApprove = false,
  disabled = false,
  isApproving = false,
  isCanceling = false,
  onApprove,
  onCancel,
}) {
  return (
    <div className="flex items-center gap-2">
      {canApprove ? (
        <button
          type="button"
          onClick={onApprove}
          disabled={disabled}
          className="ai-action-approve-button inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold disabled:opacity-55"
        >
          <IoCheckmark className="text-[0.85rem]" />
          {isApproving ? "Approving..." : "Approve"}
        </button>
      ) : (
        <span className="ai-action-disabled-pill rounded-full px-3 py-1.5 text-[0.68rem] font-semibold">
          Approve soon
        </span>
      )}
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="ai-cursor-secondary-button inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold disabled:opacity-55"
        title="Cancel prevents publication."
      >
        <IoClose className="text-[0.85rem]" />
        {isCanceling ? "Canceling..." : "Cancel"}
      </button>
    </div>
  );
}

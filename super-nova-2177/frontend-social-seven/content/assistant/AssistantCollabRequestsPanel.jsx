"use client";

import AssistantStatusBox from "./AssistantStatusBox";

export default function AssistantCollabRequestsPanel({
  error = "",
  incomingCount = 0,
  loading = false,
  onOpenProfile,
  outgoingCount = 0,
}) {
  const totalCount = incomingCount + outgoingCount;

  return (
    <div className="mt-3 border-t border-white/[0.08] pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.74rem] font-semibold text-[var(--text-gray-light)]">
          Collab requests
        </p>
        <span className="ai-action-status-pill rounded-full px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em]">
          {totalCount}
        </span>
      </div>

      {loading ? (
        <AssistantStatusBox className="mt-2 rounded-[0.85rem] p-3 text-[0.78rem]">
          Loading collab requests...
        </AssistantStatusBox>
      ) : error ? (
        <AssistantStatusBox tone="error" className="mt-2 rounded-[0.85rem] p-3 text-[0.78rem]">
          {error}
        </AssistantStatusBox>
      ) : totalCount === 0 ? (
        <AssistantStatusBox className="mt-2 rounded-[0.85rem] p-3 text-[0.78rem]">
          No pending collab requests.
        </AssistantStatusBox>
      ) : (
        <div className="ai-action-card mt-2 rounded-[0.9rem] p-3">
          <p className="text-[0.78rem] font-semibold">
            {incomingCount} incoming, {outgoingCount} outgoing pending.
          </p>
          <p className="mt-1 text-[0.72rem] leading-5 text-[var(--text-gray-light)]">
            Use the people button on your profile header for approve, decline, and cancel controls.
          </p>
          <button
            type="button"
            onClick={onOpenProfile}
            className="ai-cursor-secondary-button mt-3 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold"
          >
            Open profile
          </button>
        </div>
      )}
    </div>
  );
}

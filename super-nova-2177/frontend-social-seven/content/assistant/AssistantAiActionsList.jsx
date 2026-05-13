"use client";

import AssistantAiActionButtons from "./AssistantAiActionButtons";
import AssistantAiActionDetails, { assistantAiActionConfidenceLabel } from "./AssistantAiActionDetails";
import AssistantStatusBox from "./AssistantStatusBox";

function connectorActionLabel(actionType = "") {
  const labels = {
    draft_ai_review: "AI review draft",
    draft_ai_comment: "AI comment draft",
    draft_ai_post: "AI post draft",
    draft_vote: "Vote draft",
    draft_comment: "Comment draft",
    draft_proposal: "Post draft",
    draft_collab_request: "Collab draft",
  };
  return labels[actionType] || "Draft action";
}

function connectorActionTargetLabel(action = {}) {
  const payload = action.draft_payload || {};
  if (payload.proposal_title) return payload.proposal_title;
  if (payload.title) return payload.title;
  if (action.target_type && action.target_id) return `${action.target_type} #${action.target_id}`;
  return "Draft target";
}

function connectorActionPreview(action = {}) {
  const payload = action.draft_payload || {};
  if (action.action_type === "draft_ai_review") {
    const vote = payload.intended_choice || payload.normalized_vote || "review";
    const rationale = payload.rationale || payload.comment || payload.body || "";
    const cleanRationale = String(rationale || "").replace(/\s+/g, " ").trim();
    const preview = `${vote}: ${cleanRationale || "AI review draft"}`;
    return preview.length > 120 ? `${preview.slice(0, 120)}...` : preview;
  }
  if (action.action_type === "draft_ai_comment") {
    const body = payload.generated_comment || payload.body || "";
    const cleanBody = String(body || "").replace(/\s+/g, " ").trim();
    return cleanBody.length > 120 ? `${cleanBody.slice(0, 120)}...` : cleanBody || "AI-authored comment draft";
  }
  if (action.action_type === "draft_ai_post") {
    const body = payload.generated_post_body || payload.body || "";
    const title = payload.generated_title || payload.title || "AI-authored post draft";
    const cleanBody = String(body || "").replace(/\s+/g, " ").trim();
    const preview = `${title}: ${cleanBody}`;
    return preview.length > 120 ? `${preview.slice(0, 120)}...` : preview;
  }
  const text =
    payload.body ||
    payload.comment ||
    payload.intended_choice ||
    payload.normalized_vote ||
    payload.collaborator_username ||
    payload.action ||
    "Awaiting review";
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  return cleanText.length > 96 ? `${cleanText.slice(0, 96)}...` : cleanText;
}

function connectorActionCreatedAt(action = {}) {
  if (!action.created_at) return "";
  try {
    return new Date(action.created_at).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function AssistantAiActionsList({
  actions = [],
  busyId = null,
  error = "",
  loading = false,
  notice = "",
  onApprove,
  onCancel,
  onRefresh,
  refreshDisabled = false,
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.74rem] font-semibold text-[var(--text-gray-light)]">
          Pending approval-required actions
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshDisabled}
          className="ai-cursor-secondary-button rounded-full px-3 py-1.5 text-[0.7rem] font-semibold disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      {notice && (
        <AssistantStatusBox tone="notice" className="rounded-[0.8rem] px-3 py-2 text-[0.74rem]">
          {notice}
        </AssistantStatusBox>
      )}

      {loading ? (
        <AssistantStatusBox className="rounded-[0.85rem] p-3 text-[0.78rem]">
          Loading AI Actions...
        </AssistantStatusBox>
      ) : error ? (
        <AssistantStatusBox tone="error" className="rounded-[0.85rem] p-3 text-[0.78rem]">
          {error}
        </AssistantStatusBox>
      ) : actions.length === 0 ? (
        <AssistantStatusBox className="rounded-[0.85rem] p-3 text-[0.78rem]">
          No draft actions waiting. AI review drafts, AI-authored comment drafts, vote drafts, and collab requests will appear here before anything publishes.
        </AssistantStatusBox>
      ) : (
        <div className="ai-actions-list flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
          {actions.map((action) => {
            const busyKey = busyId || "";
            const isApproving = busyKey === `approve:${action.id}`;
            const isCanceling = busyKey === `cancel:${action.id}`;
            const isVoteDraft = action.action_type === "draft_vote";
            const isAiReviewDraft = action.action_type === "draft_ai_review";
            const isAiCommentDraft = action.action_type === "draft_ai_comment";
            const isAiPostDraft = action.action_type === "draft_ai_post";
            const isApprovableDraft = isVoteDraft || isAiReviewDraft || isAiCommentDraft || isAiPostDraft;
            const confidenceLabel = assistantAiActionConfidenceLabel(action);
            return (
              <article key={action.id} className="ai-action-card rounded-[0.9rem] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8rem] font-semibold">
                      {connectorActionLabel(action.action_type)}
                    </p>
                    <p className="truncate text-[0.72rem] text-[var(--text-gray-light)]">
                      {connectorActionTargetLabel(action)}
                    </p>
                  </div>
                  <span className="ai-action-status-pill shrink-0 rounded-full px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em]">
                    {action.status || "draft"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[0.74rem] leading-5 text-[var(--text-gray-light)]">
                  {connectorActionPreview(action)}
                </p>
                <AssistantAiActionDetails action={action} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.68rem] text-[var(--text-gray-light)]">
                    {[connectorActionCreatedAt(action), confidenceLabel].filter(Boolean).join(" - ")}
                  </span>
                  <AssistantAiActionButtons
                    canApprove={isApprovableDraft}
                    disabled={Boolean(busyId)}
                    isApproving={isApproving}
                    isCanceling={isCanceling}
                    onApprove={() => onApprove(action)}
                    onCancel={() => onCancel(action)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

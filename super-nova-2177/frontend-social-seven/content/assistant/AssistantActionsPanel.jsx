"use client";

import AssistantAiActionsList from "./AssistantAiActionsList";
import AssistantCollabRequestsPanel from "./AssistantCollabRequestsPanel";

export default function AssistantActionsPanel({
  actions = [],
  busyId = null,
  collabError = "",
  collabIncomingCount = 0,
  collabLoading = false,
  collabOutgoingCount = 0,
  error = "",
  loading = false,
  notice = "",
  onApprove,
  onCancel,
  onOpenProfile,
  onRefresh,
  refreshDisabled = false,
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <AssistantAiActionsList
        actions={actions}
        busyId={busyId}
        error={error}
        loading={loading}
        notice={notice}
        onApprove={onApprove}
        onCancel={onCancel}
        onRefresh={onRefresh}
        refreshDisabled={refreshDisabled}
      />

      <AssistantCollabRequestsPanel
        error={collabError}
        incomingCount={collabIncomingCount}
        loading={collabLoading}
        onOpenProfile={onOpenProfile}
        outgoingCount={collabOutgoingCount}
      />
    </div>
  );
}

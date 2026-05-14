"use client";

import AssistantStatusBox from "./AssistantStatusBox";

export default function AssistantReplyBox({ busy = false, busyLabel = "Thinking...", reply = "" }) {
  if (!busy && !reply) return null;

  return (
    <AssistantStatusBox className="mt-3 max-h-36 overflow-y-auto rounded-[0.85rem] p-3 text-[0.78rem] leading-5">
      {busy ? busyLabel : reply}
    </AssistantStatusBox>
  );
}

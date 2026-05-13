"use client";

import AssistantStatusBox from "./AssistantStatusBox";

export default function AssistantSettingsPanel({
  aiTesting = false,
  notice = "",
  onOpenActions,
  onOpenAiGenesis,
  onTestAi,
  onUseAiDelegate,
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <AssistantStatusBox className="rounded-[0.85rem] p-3 text-[0.72rem] leading-5">
        Drag the AI cursor onto a post, then choose AI Review or AI Comment for official delegate actions.
        Generic summarize/test utilities use the server OPENAI_API_KEY when configured; the AI widget does not store browser keys.
        AI delegate provider labels are managed in AI Genesis, with private provider connections deferred until encrypted server-side secret storage exists.
      </AssistantStatusBox>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTestAi}
          disabled={aiTesting}
          className="rounded-full bg-[var(--pink)] px-3 py-2 text-[0.74rem] font-semibold text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
        >
          {aiTesting ? "Testing..." : "Test AI"}
        </button>
      </div>
      {notice && (
        <AssistantStatusBox tone="notice" className="rounded-[0.8rem] px-3 py-2 text-[0.74rem]">
          {notice}
        </AssistantStatusBox>
      )}
      <button
        type="button"
        onClick={onOpenActions}
        className="ai-cursor-secondary-button rounded-full px-3 py-2 text-[0.74rem] font-semibold"
      >
        Open AI Actions
      </button>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onUseAiDelegate}
          className="ai-cursor-secondary-button rounded-full px-3 py-2 text-[0.74rem] font-semibold"
        >
          Use AI delegate
        </button>
        <button
          type="button"
          onClick={onOpenAiGenesis}
          className="ai-cursor-secondary-button rounded-full px-3 py-2 text-[0.74rem] font-semibold"
        >
          Open AI Genesis
        </button>
      </div>
    </div>
  );
}

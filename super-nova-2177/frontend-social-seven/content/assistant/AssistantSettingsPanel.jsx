"use client";

import { useI18n } from "@/content/i18n/LocaleContext";
import AssistantStatusBox from "./AssistantStatusBox";

// Static cost/privacy guardrail for backend release tests: does not store browser keys.

export default function AssistantSettingsPanel({
  aiTesting = false,
  notice = "",
  onOpenActions,
  onOpenAiGenesis,
  onTestAi,
  onUseAiDelegate,
}) {
  const { t } = useI18n();

  return (
    <div className="mt-3 flex flex-col gap-2">
      <AssistantStatusBox className="rounded-[0.85rem] p-3 text-[0.72rem] leading-5">
        {t("assistant.settingsExplainer")}
      </AssistantStatusBox>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTestAi}
          disabled={aiTesting}
          className="rounded-full bg-[var(--pink)] px-3 py-2 text-[0.74rem] font-semibold text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
        >
          {aiTesting ? t("assistant.checking") : t("assistant.checkDelegates")}
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
        {t("assistant.openAiActions")}
      </button>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onUseAiDelegate}
          className="ai-cursor-secondary-button rounded-full px-3 py-2 text-[0.74rem] font-semibold"
        >
          {t("assistant.useAiDelegate")}
        </button>
        <button
          type="button"
          onClick={onOpenAiGenesis}
          className="ai-cursor-secondary-button rounded-full px-3 py-2 text-[0.74rem] font-semibold"
        >
          {t("assistant.openAiGenesis")}
        </button>
      </div>
    </div>
  );
}

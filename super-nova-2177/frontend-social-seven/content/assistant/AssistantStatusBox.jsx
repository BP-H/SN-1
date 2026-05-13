"use client";

const STATUS_TONES = {
  error: "ai-action-error",
  notice: "ai-action-notice",
  result: "ai-cursor-result-box",
};

export default function AssistantStatusBox({ children, className = "", tone = "result" }) {
  const toneClass = STATUS_TONES[tone] || STATUS_TONES.result;
  return <div className={`${toneClass} ${className}`}>{children}</div>;
}

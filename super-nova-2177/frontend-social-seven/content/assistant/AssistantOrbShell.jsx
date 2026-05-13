"use client";

import { IoClose } from "react-icons/io5";

export default function AssistantOrbShell({
  children,
  onClose,
  panelStyle,
  subtitle,
  title,
}) {
  return (
    <div
      data-ai-cursor-root
      className="ai-cursor-panel fixed z-[2147482503] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[1rem] p-3 backdrop-blur-xl"
      style={panelStyle}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--pink)]">
            {title}
          </p>
          <p className="truncate text-[0.82rem] text-[var(--text-gray-light)]">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ai-cursor-panel-icon-button flex h-8 w-8 items-center justify-center rounded-full text-[0.9rem] font-semibold"
          aria-label="Close popup"
          title="Close popup"
        >
          <IoClose />
        </button>
      </div>

      {children}
    </div>
  );
}

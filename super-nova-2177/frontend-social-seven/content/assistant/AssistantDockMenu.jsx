"use client";

import { RiVoiceAiFill } from "react-icons/ri";

const DIAL_SIZE = 184;

const AiWidgetIcon = ({ className = "" }) => <RiVoiceAiFill className={className} />;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function AssistantDockMenu({
  actions = [],
  dockHidden = false,
  dockRef = null,
  dragging = false,
  ghostVisible = false,
  hoverTarget = null,
  lastSignal = null,
  menuOpen = false,
  onAction,
  onPointerDown,
  orbRef = null,
  orbSize = 56,
  pos = { x: 0, y: 0 },
  returning = false,
  variant = "floating",
  viewportHeight = 0,
  viewportWidth = 0,
}) {
  if (variant === "dock") {
    return (
      <button
        ref={dockRef}
        data-ai-cursor-root
        type="button"
        onPointerDown={onPointerDown}
        aria-label="SuperNova AI cursor"
        aria-hidden={dockHidden}
        className={`mobile-topbar-action ai-cursor-dock flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-all duration-150 ${
          dockHidden ? "ai-cursor-dock-hidden pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <AiWidgetIcon className="text-[1.12rem]" />
      </button>
    );
  }

  const centerX = pos.x + orbSize / 2;
  const centerY = pos.y + orbSize / 2;

  return (
    <>
      {ghostVisible && (
        <div
          ref={orbRef}
          data-ai-cursor-root
          className={`fixed z-[2147482500] ${dragging ? "" : "transition-[left,top,opacity,transform] duration-500 ease-out"} ${
            returning ? "ai-cursor-returning scale-75 opacity-60" : "scale-100 opacity-100"
          }`}
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        >
          <button
            data-ai-cursor-root
            type="button"
            onPointerDown={onPointerDown}
            aria-label="Drag SuperNova AI cursor"
            className={`ai-cursor-core flex h-14 w-14 items-center justify-center rounded-full text-white ${
              dragging ? "scale-105 cursor-grabbing" : "cursor-grab"
            }`}
          >
            <AiWidgetIcon className="text-[1.7rem]" />
          </button>
        </div>
      )}

      {dragging && hoverTarget && (
        <div
          data-ai-cursor-root
          className="ai-cursor-tooltip pointer-events-none fixed z-[2147482502] max-w-[15rem] rounded-full px-3 py-2 text-[0.72rem] font-semibold backdrop-blur-xl"
          style={{
            left: clamp(pos.x - 82, 8, viewportWidth - 248),
            top: Math.max(80, pos.y - 44),
          }}
        >
          Targeting {hoverTarget.title}
        </div>
      )}

      {menuOpen && (
        <>
          <div
            data-ai-cursor-root
            className="pointer-events-none fixed z-[2147482500] rounded-full ai-cursor-dial"
            style={{
              left: centerX - DIAL_SIZE / 2,
              top: centerY - DIAL_SIZE / 2,
              "--ai-dial-size": `${DIAL_SIZE}px`,
            }}
          />
          {actions.map((item) => {
            const Icon = item.icon;
            const buttonSize = item.size === "primary" ? 46 : 42;
            const signalActive = item.action === lastSignal;
            return (
              <button
                key={item.action}
                data-ai-cursor-root
                data-active={signalActive ? "true" : "false"}
                data-tone={item.tone || "neutral"}
                type="button"
                onClick={() => onAction?.(item.action)}
                className="ai-cursor-action-button fixed z-[2147482502] flex items-center justify-center rounded-full backdrop-blur-xl transition-transform active:scale-95"
                style={{
                  left: clamp(centerX + item.dx - buttonSize / 2, 8, viewportWidth - buttonSize - 8),
                  top: clamp(centerY + item.dy - buttonSize / 2, 72, viewportHeight - buttonSize - 8),
                  width: buttonSize,
                  height: buttonSize,
                }}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className={item.size === "primary" ? "text-[1.16rem]" : "text-[1rem]"} />
              </button>
            );
          })}
        </>
      )}
    </>
  );
}

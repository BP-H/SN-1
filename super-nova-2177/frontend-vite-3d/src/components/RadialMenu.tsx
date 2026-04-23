// src/components/RadialMenu.tsx
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import "./RadialMenu.css";

/** A simple radial item (used by the lightweight menu mode) */
export type RadialMenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
};

/** Simple mode: used by PortalOrb — just supply items and onClose */
type SimpleProps = {
  center: { x: number; y: number };
  onClose: () => void;
  items: RadialMenuItem[];
};

/** Full mode: used by the Assistant orb — full callback surface */
type FullProps = {
  center: { x: number; y: number };
  onClose: () => void;

  onChat: () => void;
  onReact: (emoji: string) => void;
  onComment: () => void;
  onRemix: () => void;
  onShare: () => void;
  onProfile: () => void;

  avatarUrl: string;
  emojis: string[];

  // Prevent mixing with simple mode accidentally
  items?: never;
};

/** Union of both modes */
type RadialMenuProps = SimpleProps | FullProps;

/** Type guard to narrow to SimpleProps at runtime */
function isSimpleProps(p: RadialMenuProps): p is SimpleProps {
  return Array.isArray((p as any).items);
}

export default function RadialMenu(props: RadialMenuProps) {
  // If `items` is present, render the lightweight menu (Simple mode)
  if (isSimpleProps(props)) {
    return (
      <SimpleRadialMenu
        center={props.center}
        items={props.items}
        onClose={props.onClose}
      />
    );
  }

  // Full mode (Assistant orb)
  const {
    center,
    onClose,
    onChat,
    onReact,
    onComment,
    onRemix,
    onShare,
    onProfile,
    avatarUrl,
    emojis,
  } = props;

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [subMenu, setSubMenu] = useState<"react" | "create" | null>(null);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  // Clamp the visual origin into the viewport & rotate the ring near edges
  const [origin, setOrigin] = useState(center);
  const [angleOffset, setAngleOffset] = useState(0);

  useEffect(() => {
    menuRef.current?.focus();
    setSubMenu(null);
    setIndex(0);
  }, []);

  const rootRadius = 74;
  const subRadius = 120;

  const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const radius = subMenu ? subRadius : rootRadius;
    const pad = radius + 20; // button radius + margin
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Clamp origin
    const cx = clamp(center.x, pad, vw - pad);
    const cy = clamp(center.y, pad, vh - pad);
    setOrigin({ x: cx, y: cy });

    // Compute a rotation so items don't land off-screen
    const nearLeft = center.x < pad;
    const nearRight = center.x > vw - pad;
    const nearTop = center.y < pad;
    const nearBottom = center.y > vh - pad;

    let rot = 0;
    if (nearLeft && nearTop) rot = 135;
    else if (nearLeft && nearBottom) rot = 45;
    else if (nearRight && nearTop) rot = -135;
    else if (nearRight && nearBottom) rot = -45;
    else if (nearLeft) rot = 90;
    else if (nearRight) rot = -90;
    else if (nearTop) rot = 180;
    else rot = 0;

    setAngleOffset(rot);
  }, [center, subMenu]);

  const menuConfig = {
    root: [
      {
        id: "chat",
        label: "Chat",
        icon: "💬",
        action: () => {
          onChat();
          onClose();
        },
      },
      { id: "react", label: "React", icon: "👏", next: "react" as const },
      { id: "create", label: "Create", icon: "✍️", next: "create" as const },
      {
        id: "profile",
        label: "Profile",
        icon: (
          <img
            src={avatarUrl}
            alt=""
            aria-hidden="true"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ),
        action: () => {
          onProfile();
          onClose();
        },
      },
    ],
    react: emojis.map((e, i) => ({
      id: `emoji-${i}`,
      label: `React ${e}`,
      icon: e,
      action: () => {
        onReact(e);
        onClose();
      },
    })),
    create: [
      {
        id: "comment",
        label: "Comment",
        icon: "✍️",
        action: () => {
          onComment();
          onClose();
        },
      },
      {
        id: "remix",
        label: "Remix",
        icon: "🎬",
        action: () => {
          onRemix();
          onClose();
        },
      },
      {
        id: "share",
        label: "Share",
        icon: "↗️",
        action: () => {
          onShare();
          onClose();
        },
      },
    ],
  } as const;

  const ringItems =
    subMenu === null
      ? menuConfig.root
      : subMenu === "react"
      ? menuConfig.react
      : menuConfig.create;

  const centerItem =
    subMenu === null
      ? { id: "close", label: "Close menu", icon: "✖️", action: onClose }
      : {
          id: "back",
          label: "Go back",
          icon: "⬅️",
          action: () => {
            setSubMenu(null);
            setIndex(0);
          },
        };

  // keyboard navigation includes the center control as the last virtual item
  const currentItems = [...ringItems, centerItem];

  function handleKeyDown(e: React.KeyboardEvent) {
    const total = currentItems.length;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (i + 1) % total);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (i - 1 + total) % total);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const isCenter = index === ringItems.length;
      if (isCenter) {
        centerItem.action();
      } else {
        const item = ringItems[index] as any;
        if (item.next) {
          setSubMenu(item.next);
          setIndex(0);
        } else {
          item.action();
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (subMenu !== null) {
        setSubMenu(null);
        setIndex(0);
      } else {
        onClose();
      }
    }
  }

  const angleFor = (i: number, len: number) =>
    (360 / len) * i - 90 + angleOffset;

  function renderItem(
    item: any,
    i: number,
    active: boolean,
    radius: number,
    len: number
  ) {
    const rad = (angleFor(i, len) * Math.PI) / 180;
    const x = radius * Math.cos(rad) - 20;
    const y = radius * Math.sin(rad) - 20;
    return (
      <motion.button
        key={item.id}
        id={`assistant-menu-item-${item.id}`}
        role="menuitem"
        tabIndex={-1}
        aria-label={item.label}
        className="rbtn"
        style={{ left: -20, top: -20 }}
        initial={
          reduceMotion
            ? { opacity: 1, x, y, scale: 1 }
            : { opacity: 0, x: 0, y: 0, scale: 0 }
        }
        animate={{
          opacity: 1,
          x,
          y,
          scale: 1,
          boxShadow: active ? "0 0 0 2px var(--rm-ring)" : "none",
        }}
        exit={
          reduceMotion
            ? { opacity: 1, x, y, scale: 1 }
            : { opacity: 0, x: 0, y: 0, scale: 0 }
        }
        transition={{
          duration: reduceMotion ? 0 : 0.25,
          ease: [0.4, 0, 0.2, 1],
        }}
        whileHover={reduceMotion ? undefined : { scale: 1.06, opacity: 0.95 }}
        whileFocus={reduceMotion ? undefined : { scale: 1.06, opacity: 0.95 }}
        onClick={() => {
          if (item.next) {
            setSubMenu(item.next);
            setIndex(0);
          } else {
            item.action();
          }
        }}
      >
        {item.icon}
      </motion.button>
    );
  }

  const activeId =
    index === ringItems.length
      ? subMenu === null
        ? "close"
        : "back"
      : ringItems[index]?.id || "";

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-activedescendant={`assistant-menu-item-${activeId}`}
      style={{
        position: "fixed",
        left: origin.x,
        top: origin.y,
        width: 0,
        height: 0,
        zIndex: 9998,
      }}
    >
      <AnimatePresence>
        {ringItems.map((item, i) =>
          renderItem(
            item,
            i,
            i === index,
            subMenu === null ? rootRadius : subRadius,
            ringItems.length
          )
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.button
          key={subMenu === null ? "close" : "back"}
          id={
            subMenu === null
              ? "assistant-menu-item-close"
              : "assistant-menu-item-back"
          }
          role="menuitem"
          tabIndex={-1}
          aria-label={centerItem.label}
          className="rbtn"
          style={{ left: -20, top: -20 }}
          initial={
            reduceMotion
              ? { opacity: 1, x: 0, y: 0, scale: 1 }
              : { opacity: 0, x: 0, y: 0, scale: 0 }
          }
          animate={{
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            boxShadow:
              index === ringItems.length ? "0 0 0 2px var(--rm-ring)" : "none",
          }}
          exit={
            reduceMotion
              ? { opacity: 1, x: 0, y: 0, scale: 1 }
              : { opacity: 0, x: 0, y: 0, scale: 0 }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.25,
            ease: [0.4, 0, 0.2, 1],
          }}
          whileHover={
            reduceMotion ? undefined : { scale: 1.06, opacity: 0.95 }
          }
          whileFocus={
            reduceMotion ? undefined : { scale: 1.06, opacity: 0.95 }
          }
          onClick={centerItem.action}
        >
          {subMenu === null ? "✖️" : "⬅️"}
        </motion.button>
      </AnimatePresence>
    </div>
  );
}

/** Lightweight radial menu used by PortalOrb */
function SimpleRadialMenu({ center, items, onClose }: SimpleProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    menuRef.current?.focus();
    setIndex(0);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    const len = items.length;
    if (
      e.key === "ArrowRight" ||
      e.key === "ArrowDown" ||
      (e.key === "Tab" && !e.shiftKey)
    ) {
      e.preventDefault();
      const next = (index + 1) % len;
      setIndex(next);
      itemRefs.current[next]?.focus();
    } else if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowUp" ||
      (e.key === "Tab" && e.shiftKey)
    ) {
      e.preventDefault();
      const next = (index - 1 + len) % len;
      setIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      items[index]?.action();
    }
  }

  return (
    <div
      className="radial-menu"
      role="menu"
      tabIndex={-1}
      ref={menuRef}
      onKeyDown={handleKeyDown}
      aria-activedescendant={`simple-radial-item-${items[index]?.id}`}
      style={{
        position: "fixed",
        left: center.x,
        top: center.y,
        width: 0,
        height: 0,
        zIndex: 9998,
        pointerEvents: "none",
      }}
    >
      {items.map((item, i) => {
        const angle = (360 / items.length) * i - 90;
        const rad = (angle * Math.PI) / 180;
        const iconX = 94 * Math.cos(rad);
        const iconY = 94 * Math.sin(rad);
        const labelX = 140 * Math.cos(rad);
        const labelY = 140 * Math.sin(rad);
        return (
          <React.Fragment key={item.id}>
            <button
              className="rbtn"
              onClick={item.action}
              role="menuitem"
              ref={(el) => (itemRefs.current[i] = el)}
              tabIndex={index === i ? 0 : -1}
              id={`simple-radial-item-${item.id}`}
              aria-label={item.label}
              title={item.label}
              style={{
                pointerEvents: "auto",
                left: iconX - 20,
                top: iconY - 20,
              }}
            >
              {item.icon}
            </button>
            <span className="rm-label" style={{ left: labelX, top: labelY }}>
              {item.label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
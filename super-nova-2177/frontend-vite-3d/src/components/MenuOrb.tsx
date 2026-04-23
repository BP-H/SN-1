import React, { useState } from "react";
import bus from "../lib/bus";
import "./orbs.css";

export default function MenuOrb() {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  function toggleSidebar() {
    bus.emit("sidebar:toggle");
  }

  const cls = [
    "orb",
    "orb--menu",
    hover ? "is-hover" : "",
    press ? "is-press" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      aria-label="Toggle sidebar"
      style={{ "--x": "16px", "--y": "16px" } as React.CSSProperties}
      onClick={toggleSidebar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleSidebar();
        }
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => { setHover(false); setPress(false); }}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
    >
      <div className="orb__core" />
      <div className="orb__ring" />
    </div>
  );
}

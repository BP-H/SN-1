"use client";

import { useState } from "react";
import { FaCommentAlt } from "react-icons/fa";

function Comments({ onClick, commentsNum }) {
  const [active, setActive] = useState(false);

  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-full bg-[var(--gray)] px-1 py-1 text-[var(--text-black)] shadow-md"
      onClick={() => {
        setActive((value) => !value);
        onClick?.();
      }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{
          color: active ? "white" : "var(--text-black)",
          background: active ? "var(--pink)" : "rgba(255,255,255,0.08)",
          boxShadow: active ? "var(--shadow-pink)" : "none",
        }}
      >
        <FaCommentAlt />
      </span>
      <span className="pr-2 text-[0.85rem]">{commentsNum}</span>
    </button>
  );
}

export default Comments;

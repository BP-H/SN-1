"use client";
import { useState } from "react";
import { FaCommentAlt } from "react-icons/fa";

function Comments({ onClick, commentsNum }) {
  const [clicked, setClicked] = useState(null);

  return (
    <div
      className="flex text-[var(--text-black)] bg-[var(--gray)] shadow-md w-fit gap-2 cursor-pointer rounded-full px-1 pr-2 py-1 items-center justify-between"
      onClick={() => {
        setClicked(clicked === "like" ? null : "like");
        if (onClick) onClick();
      }}
    >
      <button
        style={{
          color: clicked === "like" ? "white" : "var(--text-black)",
          background: clicked === "like" ? "var(--pink)" : "",
          boxShadow: clicked === "like" ? "var(--shadow-pink)" : "none",
        }}
        className={`flex items-center bg-[var(--transparent-gray)] justify-center gap-1 rounded-full px-2 py-0 h-[30px] w-[30px] cursor-pointer ${
          clicked === "like" ? "" : ""
        }`}
      >
        <FaCommentAlt />
      </button>
      <p className="h-fit">{commentsNum}</p>
    </div>
  );
}

export default Comments;
 
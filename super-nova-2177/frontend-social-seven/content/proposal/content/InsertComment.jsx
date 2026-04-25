"use client";
import { useState } from "react";
import { useUser } from "@/content/profile/UserContext";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";

function InsertComment({
  proposalId,
  setNotify = () => {},
  setErrorMsg = () => {},
  setLocalComments = () => {},
}) {
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePublish = async () => {
    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
      }
      return;
    }

    const errors = [];
    if (!userData?.name) errors.push("User name is missing.");
    if (!proposalId) errors.push("Proposal ID is missing.");
    if (!comment.trim()) errors.push("Comment is empty.");

    if (errors.length > 0) {
      setErrorMsg(errors);
      return; // interrompe antes de enviar
    }

    // só aqui se faz o fetch
    const avatar = normalizeAvatarValue(userData.avatar || "");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: Number(proposalId),
          user: userData.name,
          user_img: avatar,
          species: userData.species,
          comment: comment.trim(),
        }),
      });

      if (!res.ok) {
        let message = `Failed to post comment: ${res.status} ${res.statusText}`;
        try {
          const payload = await res.json();
          message = payload?.detail || payload?.message || message;
        } catch {
          const errorBody = await res.text();
          if (errorBody) {
            message = `${message} - ${errorBody}`;
          }
        }
        setErrorMsg([message]);
        return;
      }

      const payload = await res.json();
      setNotify(["Comment Submitted"]);
      setComment("");

      const newComment = payload?.comments?.[0] || {
        proposal_id: Number(proposalId),
        user: userData.name,
        user_img: avatar,
        species: userData.species || "human",
        comment: comment.trim(),
      };
      setLocalComments((prevComments) => [...prevComments, newComment]);
    } catch (err) {
      setErrorMsg([`Error sending comment: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const [imgError, setImgError] = useState(false);
  const avatarSrc = isAuthenticated ? avatarDisplayUrl(userData.avatar, defaultAvatar) : defaultAvatar;

  return (
    <div className="mb-3 flex w-full min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--gray)] shadow-sm">
        {avatarSrc && !imgError ? (
          <img
            src={avatarSrc}
            alt={userData.name}
            className="h-9 w-9 rounded-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="font-bold text-[var(--text-black)]">
            {userData.initials || "SN"}
          </span>
        )}
      </div>
      <input
        type="text"
        placeholder="Add a comment..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handlePublish();
          }
        }}
        className="h-10 min-w-0 flex-1 rounded-full border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.045)] px-4 text-[0.88rem] text-[var(--text-black)] outline-none placeholder:text-[var(--text-gray-light)]"
      />
      <button
        type="button"
        onClick={handlePublish}
        disabled={loading}
        className="h-10 min-w-[4.75rem] shrink-0 whitespace-nowrap rounded-full bg-[var(--pink)] px-3 text-[0.78rem] font-semibold text-white shadow-md hover:scale-95 disabled:opacity-50"
      >
        {loading ? "Posting..." : "Post"}
      </button>
    </div>
  );
}

export default InsertComment;

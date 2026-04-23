"use client";
import { useState } from "react";
import { useUser } from "@/content/profile/UserContext";
import { API_BASE_URL } from "@/utils/apiBase";

function InsertComment({
  proposalId,
  setNotify = () => {},
  setErrorMsg = () => {},
  setLocalComments = () => {},
}) {
  const { userData, defaultAvatar } = useUser();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidImage = (url) => {
    return /\.(jpeg|jpg|png|webp|gif)$/i.test(url);
  };

  const handlePublish = async () => {
    const errors = [];
    if (!userData?.name) errors.push("User name is missing.");
    if (!proposalId) errors.push("Proposal ID is missing.");
    if (!comment.trim()) errors.push("Comment is empty.");

    if (errors.length > 0) {
      setErrorMsg(errors);
      return; // interrompe antes de enviar
    }

    // só aqui se faz o fetch
    let avatar = defaultAvatar || userData.initials;
    if (userData.avatar && isValidImage(userData.avatar)) {
      avatar = userData.avatar;
    }

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

  return (
    <div className="mb-3 flex w-full min-w-0 items-center gap-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--gray)] shadow-sm">
        {userData.avatar && isValidImage(userData.avatar) && !imgError ? (
          <img
            src={userData.avatar}
            alt={userData.name}
            className="object-cover w-10 h-10 rounded-full"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="font-bold text-[var(--text-black)]">
            {userData.initials}
          </span>
        )}
      </div>
      <input
        type="text"
        placeholder="Insert Comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="h-10 min-w-0 flex-1 rounded-full border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.05)] px-4 text-[0.88rem] text-[var(--text-black)] outline-none placeholder:text-[var(--text-gray-light)]"
      />
      <button
        type="button"
        onClick={handlePublish}
        disabled={loading}
        className="h-10 shrink-0 rounded-full bg-[var(--pink)] px-3 text-[0.78rem] font-semibold text-white shadow-md hover:scale-95 disabled:opacity-50"
      >
        {loading ? "Publishing..." : "Publish"}
      </button>
    </div>
  );
}

export default InsertComment;

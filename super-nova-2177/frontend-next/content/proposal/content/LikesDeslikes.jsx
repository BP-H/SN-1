"use client";
import { useState, useEffect } from "react";
import { BiSolidLike, BiSolidDislike } from "react-icons/bi";
import { IoIosArrowUp } from "react-icons/io";
import LikesInfo from "./LikesInfo";
import { IoIosClose } from "react-icons/io";
import { useUser } from "@/content/profile/UserContext";
import { API_BASE_URL } from "@/utils/apiBase";

function LikesDeslikes({
  initialLikes,
  initialDislikes,
  initialClicked = null,
  proposalId,
  setErrorMsg,
  className
}) {
  const [clicked, setClicked] = useState(initialClicked);
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [action, setAction] = useState(false);
  const { userData } = useUser();
  const backendUrl = userData?.activeBackend || API_BASE_URL;

  const voterType = userData?.species?.trim() || "human";

  useEffect(() => {
    setLikes(Number(initialLikes) || 0);
    setDislikes(Number(initialDislikes) || 0);
    setClicked(initialClicked);
  }, [initialLikes, initialDislikes, initialClicked]);

  async function getApiError(response, fallback) {
    try {
      const payload = await response.json();
      return payload?.detail || payload?.message || fallback;
    } catch {
      try {
        const text = await response.text();
        return text || fallback;
      } catch {
        return fallback;
      }
    }
  }

  const validateProfile = () => {
    const errors = [];
    if (!backendUrl) {
      errors.push("API base URL is not configured.");
    }
    if (!userData?.name) {
      errors.push("Add a display name in your profile before voting.");
    }

    if (errors.length > 0) {
      setErrorMsg(errors);
      return false;
    }

    if (!userData?.species) {
      setErrorMsg([
        "You haven't selected a species in your profile yet. We'll submit this vote as a human until you update it.",
      ]);
    }

    return true;
  };

  async function sendVote(choice) {
    try {
      const response = await fetch(`${backendUrl}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: proposalId,
          username: userData.name,
          choice: choice,
          voter_type: voterType,
        }),
      });

      if (!response.ok) {
        const message = await getApiError(response, `Failed to send vote: ${response.status} ${response.statusText}`);
        setErrorMsg([message]);
        return false;
      }

      return true;
    } catch (error) {
      setErrorMsg([`Failed to send vote: ${error.message}`]);
      return false;
    }
  }

  async function removeVote() {
    try {
      const response = await fetch(
        `${backendUrl}/votes?proposal_id=${proposalId}&username=${userData.name}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const message = await getApiError(response, `Failed to remove vote: ${response.status} ${response.statusText}`);
        setErrorMsg([message]);
        return false;
      }

      return true;
    } catch (error) {
      setErrorMsg([`Failed to remove vote: ${error.message}`]);
      return false;
    }
  }

  const handleLikeClick = async () => {
    if (!validateProfile()) return;

    if (clicked === "like") {
      // Un-like: remove the vote
      const removed = await removeVote();
      if (removed) {
        setLikes((value) => Math.max(0, value - 1));
        setClicked(null);
      }
    } else {
      // Switching from dislike → like: remove old vote first
      if (clicked === "dislike") {
        const removed = await removeVote();
        if (!removed) return;
        setDislikes((value) => Math.max(0, value - 1));
      }
      const success = await sendVote("up");
      if (!success) return;
      setLikes((value) => value + 1);
      setClicked("like");
    }
  };

  const handleDislikeClick = async () => {
    if (!validateProfile()) return;

    if (clicked === "dislike") {
      // Un-dislike: remove the vote
      const removed = await removeVote();
      if (removed) {
        setDislikes((value) => Math.max(0, value - 1));
        setClicked(null);
      }
    } else {
      // Switching from like → dislike: remove old vote first
      if (clicked === "like") {
        const removed = await removeVote();
        if (!removed) return;
        setLikes((value) => Math.max(0, value - 1));
      }
      const success = await sendVote("down");
      if (!success) return;
      setDislikes((value) => value + 1);
      setClicked("dislike");
    }
  };

  return (
    <>
      <div className="flex text-[var(--text-black)] bg-[var(--gray)] shadow-md w-fit gap-2 rounded-full px-1 py-1 items-center justify-between">
        <button
          onClick={handleLikeClick}
          style={{
            color: clicked === "like" ? "white" : "var(--text-black)",
            background: clicked === "like" ? "var(--pink)" : "transparent",
            boxShadow: clicked === "like" ? "var(--shadow-pink)" : "none",
          }}
          className={`flex items-center justify-center gap-1 rounded-full px-2 py-0 h-[30px] cursor-pointer ${
            clicked === "like" ? "" : ""
          }`}
        >
          <BiSolidLike />
          <p className="h-fit">{likes}</p>
        </button>
        <button
          onClick={handleDislikeClick}
          style={{
            color: clicked === "dislike" ? "white" : "var(--text-black)",
            background: clicked === "dislike" ? "var(--blue)" : "transparent",
            boxShadow: clicked === "dislike" ? "var(--shadow-blue)" : "none",
          }}
          className={`flex items-center justify-center gap-1 rounded-full px-2 h-[30px] py-0 cursor-pointer ${
            clicked === "dislike" ? "" : ""
          }`}
        >
          <BiSolidDislike />
          <p className="h-fit">{dislikes}</p>
        </button>
        {action ? (
          <IoIosClose
            onClick={() => setAction(false)}
            className="text-white rounded-full h-[30px] w-[30px] bg-[var(--transparent-gray)] cursor-pointer"
          />
        ) : (
          <IoIosArrowUp
            onClick={() => setAction(true)}
            className="text-white rounded-full h-[30px] w-[30px] bg-[var(--transparent-gray)] cursor-pointer"
          />
        )}
      </div>
      <div className={`absolute ${className ? "-top-[-45px]" : "-top-55 md:-top-55 lg:-top-55 xl:-top-55"}`}>
        {action ? (
          <LikesInfo
            proposalId={proposalId}
          />
        ) : (
          ""
        )}
      </div>
    </>
  );
}

export default LikesDeslikes;

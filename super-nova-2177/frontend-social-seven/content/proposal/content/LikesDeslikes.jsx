"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BiSolidDislike, BiSolidLike } from "react-icons/bi";
import { IoChevronUp } from "react-icons/io5";
import { useUser } from "@/content/profile/UserContext";
import { useI18n } from "@/content/i18n/LocaleContext";
import { API_BASE_URL } from "@/utils/apiBase";
import {
  BACKEND_AUTH_MISSING_MESSAGE,
  authHeaders,
  formatBackendAuthErrorMessage,
  requireBackendAuthSession,
} from "@/utils/authSession";
import {
  adjustAuthoritativeVoteSummary,
  weightedVoteSummary,
} from "@/utils/voteWeights";
import LikesInfo from "./LikesInfo";
import VoteBreakdownModal from "./VoteBreakdownModal";

const SLIDER_BLUE = "#5e8dfa";

/* Interpolate between AI blue and pink. Old blue start: hsl(230,80%,75%). */
function getSliderColor(ratio) {
  const pinkShare = Math.round(Math.min(Math.max(ratio, 0), 100));
  return `color-mix(in srgb, ${SLIDER_BLUE} ${100 - pinkShare}%, var(--pink) ${pinkShare}%)`;
}

/* Voter identity is case-insensitive everywhere on the backend, so optimistic
   list edits must match that to avoid leaving a stale duplicate of the voter. */
const sameVoter = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();

function cloneVoteList(items) {
  return (items || []).map((item) => ({ ...item }));
}

function cloneVoteSummary(summary) {
  if (!summary || typeof summary !== "object") return summary || null;
  return {
    ...summary,
    by_species: summary.by_species
      ? Object.fromEntries(
          Object.entries(summary.by_species).map(([species, value]) => [
            species,
            { ...(value || {}) },
          ])
        )
      : summary.by_species,
  };
}

function deriveVoteState(snapshot, nextClicked, voterName, voterType) {
  const previousChoice =
    snapshot.clicked === "like" ? "up" : snapshot.clicked === "dislike" ? "down" : null;
  const nextChoice = nextClicked === "like" ? "up" : nextClicked === "dislike" ? "down" : null;
  const voter = { voter: voterName, type: voterType };
  const likesList = snapshot.likesList.filter((vote) => !sameVoter(vote.voter, voterName));
  const dislikesList = snapshot.dislikesList.filter((vote) => !sameVoter(vote.voter, voterName));

  if (nextChoice === "up") likesList.push(voter);
  if (nextChoice === "down") dislikesList.push(voter);

  return {
    clicked: nextClicked,
    likes: Math.max(
      0,
      snapshot.likes - (previousChoice === "up" ? 1 : 0) + (nextChoice === "up" ? 1 : 0)
    ),
    dislikes: Math.max(
      0,
      snapshot.dislikes - (previousChoice === "down" ? 1 : 0) + (nextChoice === "down" ? 1 : 0)
    ),
    likesList,
    dislikesList,
    authoritativeSummary: adjustAuthoritativeVoteSummary(snapshot.authoritativeSummary, {
      species: voterType,
      previousChoice,
      nextChoice,
    }),
  };
}

async function getApiError(response, fallback) {
  try {
    const raw = await response.text();
    try {
      const payload = JSON.parse(raw);
      return formatBackendAuthErrorMessage(payload?.detail || payload?.message, fallback);
    } catch {
      return formatBackendAuthErrorMessage(raw, fallback);
    }
  } catch {
    return fallback;
  }
}

function LikesDeslikes({
  initialLikes,
  initialDislikes,
  initialLikesList = [],
  initialDislikesList = [],
  initialVoteSummary = null,
  initialClicked = null,
  proposalId,
  votingClosed = false,
  onVoteSummaryChange = () => {},
  setErrorMsg = () => {},
}) {
  const { t } = useI18n();
  const [clicked, setClicked] = useState(initialClicked);
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [likesList, setLikesList] = useState(initialLikesList);
  const [dislikesList, setDislikesList] = useState(initialDislikesList);
  const [authoritativeSummary, setAuthoritativeSummary] = useState(initialVoteSummary);
  const [showInfo, setShowInfo] = useState(false);
  const [closingInfo, setClosingInfo] = useState(false);
  const containerRef = useRef(null);
  const infoToggleRef = useRef(null);
  /* Guards against re-entrant votes (rapid double-click / overlapping AI action)
     that would fire two requests and double-count the optimistic tally. */
  const voteInFlightRef = useRef(false);
  const voteTransactionRef = useRef(0);
  const activeVoteTransactionRef = useRef(null);
  const { userData, isAuthenticated } = useUser();
  const backendUrl = userData?.activeBackend || API_BASE_URL;
  const voterType = userData?.species?.trim() || "human";

  useEffect(() => {
    voteTransactionRef.current += 1;
    activeVoteTransactionRef.current = null;
    voteInFlightRef.current = false;
    setLikes(Number(initialLikes) || 0);
    setDislikes(Number(initialDislikes) || 0);
    setLikesList(initialLikesList || []);
    setDislikesList(initialDislikesList || []);
    setAuthoritativeSummary(initialVoteSummary || null);
    setClicked(initialClicked);
  }, [proposalId, initialLikes, initialDislikes, initialLikesList, initialDislikesList, initialVoteSummary, initialClicked]);

  useEffect(() => {
    return () => {
      voteTransactionRef.current += 1;
      activeVoteTransactionRef.current = null;
      voteInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    const postCard = containerRef.current?.closest?.("[data-proposal-card]");
    if (postCard) postCard.dataset.proposalUserVote = clicked || "";
  }, [clicked]);

  useEffect(() => {
    const handleProfileUpdate = (event) => {
      const detail = event.detail || {};
      if (!detail.username) return;
      const aliases = [detail.previousUsername, detail.oldUsername]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      if (!aliases.length) return;
      const renameVote = (vote) =>
        aliases.includes(String(vote?.voter || "").toLowerCase())
          ? { ...vote, voter: detail.username }
          : vote;
      setLikesList((items) => items.map(renameVote));
      setDislikesList((items) => items.map(renameVote));
    };
    window.addEventListener("supernova:profile-avatar-updated", handleProfileUpdate);
    return () => window.removeEventListener("supernova:profile-avatar-updated", handleProfileUpdate);
  }, []);

  const weighted = useMemo(() => {
    return weightedVoteSummary(authoritativeSummary, likesList, dislikesList);
  }, [authoritativeSummary, likesList, dislikesList]);

  const pct = Math.max(weighted.supportPercent || 0, 0);
  const approvalRatio = Math.round(pct);
  const knobColor = getSliderColor(pct);

  /* Close with a short exit animation, then unmount and restore focus. */
  const closeInfo = useCallback(() => {
    setClosingInfo(true);
  }, []);

  const handleInfoClosed = useCallback(() => {
    setShowInfo(false);
    setClosingInfo(false);
    infoToggleRef.current?.focus?.();
  }, []);

  const voteModal = showInfo ? (
    <VoteBreakdownModal
      closing={closingInfo}
      onRequestClose={closeInfo}
      onClosed={handleInfoClosed}
    >
      <LikesInfo
        proposalId={proposalId}
        likesData={likesList}
        dislikesData={dislikesList}
        voteSummary={authoritativeSummary}
      />
    </VoteBreakdownModal>
  ) : null;

  const validateProfile = useCallback(() => {
    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
      }
      return false;
    }
    try {
      requireBackendAuthSession();
    } catch {
      setErrorMsg([BACKEND_AUTH_MISSING_MESSAGE]);
      return false;
    }
    const errors = [];
    if (!backendUrl) errors.push("API base URL is not configured.");
    if (isAuthenticated && !userData?.name) errors.push("Add a display name in your profile before voting.");
    if (errors.length > 0) {
      setErrorMsg(errors);
      return false;
    }
    return true;
  }, [backendUrl, isAuthenticated, setErrorMsg, userData?.name]);

  const sendVote = useCallback(async (choice) => {
    try {
      const response = await fetch(`${backendUrl}/votes`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ proposal_id: proposalId, username: userData.name, choice, voter_type: voterType }),
      });
      if (!response.ok) {
        return { ok: false, error: await getApiError(response, `Vote failed: ${response.status}`) };
      }
      return { ok: true, error: "" };
    } catch (err) {
      return { ok: false, error: formatBackendAuthErrorMessage(err, "Vote failed.") };
    }
  }, [backendUrl, proposalId, userData?.name, voterType]);

  const removeVote = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        proposal_id: String(proposalId),
        username: userData.name,
      });
      const response = await fetch(`${backendUrl}/votes?${params.toString()}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) {
        return { ok: false, error: await getApiError(response, `Remove failed: ${response.status}`) };
      }
      return { ok: true, error: "" };
    } catch (err) {
      return { ok: false, error: formatBackendAuthErrorMessage(err, "Remove failed.") };
    }
  }, [backendUrl, proposalId, userData?.name]);

  const applyVoteState = useCallback((state) => {
    setClicked(state.clicked);
    setLikes(state.likes);
    setDislikes(state.dislikes);
    setLikesList(state.likesList);
    setDislikesList(state.dislikesList);
    setAuthoritativeSummary(state.authoritativeSummary);
    onVoteSummaryChange(state.authoritativeSummary);
  }, [onVoteSummaryChange]);

  const performVote = useCallback(async (requestedClicked, { allowToggle = true } = {}) => {
    if (votingClosed) return;
    if (!validateProfile()) return;
    if (voteInFlightRef.current) return;
    if (clicked === requestedClicked && !allowToggle) return;

    voteInFlightRef.current = true;
    const transaction = voteTransactionRef.current + 1;
    voteTransactionRef.current = transaction;
    activeVoteTransactionRef.current = transaction;
    const snapshot = {
      clicked,
      likes,
      dislikes,
      likesList: cloneVoteList(likesList),
      dislikesList: cloneVoteList(dislikesList),
      authoritativeSummary: cloneVoteSummary(authoritativeSummary),
    };
    const nextClicked = clicked === requestedClicked ? null : requestedClicked;
    const optimisticState = deriveVoteState(
      snapshot,
      nextClicked,
      userData.name,
      voterType
    );
    applyVoteState(optimisticState);

    try {
      const result = nextClicked === null
        ? await removeVote()
        : await sendVote(nextClicked === "like" ? "up" : "down");
      if (activeVoteTransactionRef.current !== transaction) return;
      if (!result.ok) {
        applyVoteState(snapshot);
        setErrorMsg([result.error]);
      }
    } finally {
      if (activeVoteTransactionRef.current === transaction) {
        activeVoteTransactionRef.current = null;
        voteInFlightRef.current = false;
      }
    }
  }, [
    applyVoteState,
    authoritativeSummary,
    clicked,
    dislikes,
    dislikesList,
    likes,
    likesList,
    removeVote,
    sendVote,
    setErrorMsg,
    userData?.name,
    validateProfile,
    voterType,
    votingClosed,
  ]);

  const handleLikeClick = useCallback((options = {}) => {
    return performVote("like", options);
  }, [performVote]);

  const handleDislikeClick = useCallback((options = {}) => {
    return performVote("dislike", options);
  }, [performVote]);

  useEffect(() => {
    const handleCursorAction = (event) => {
      const detail = event.detail || {};
      if (String(detail.id) !== String(proposalId)) return;
      const allowToggle =
        typeof detail.allowToggle === "boolean"
          ? detail.allowToggle
          : detail.source !== "ai-widget";
      if (detail.action === "like") {
        handleLikeClick({ allowToggle });
      }
      if (detail.action === "dislike") {
        handleDislikeClick({ allowToggle });
      }
      if (detail.action === "vote-recorded") {
        const voter = detail.voter || detail.username || "AI delegate";
        const type = detail.voter_type || detail.type || "ai";
        const nextVote = detail.vote === "up" || detail.vote === "support" ? "like" : detail.vote === "down" || detail.vote === "oppose" ? "dislike" : "";
        if (!nextVote || !voter) return;
        setLikesList((items) => {
          const filtered = items.filter((vote) => String(vote?.voter || "").toLowerCase() !== String(voter).toLowerCase());
          const next = nextVote === "like" ? [...filtered, { voter, type }] : filtered;
          setLikes(next.length);
          return next;
        });
        setDislikesList((items) => {
          const filtered = items.filter((vote) => String(vote?.voter || "").toLowerCase() !== String(voter).toLowerCase());
          const next = nextVote === "dislike" ? [...filtered, { voter, type }] : filtered;
          setDislikes(next.length);
          return next;
        });
      }
    };

    window.addEventListener("supernova:post-action", handleCursorAction);
    return () => window.removeEventListener("supernova:post-action", handleCursorAction);
  }, [proposalId, handleLikeClick, handleDislikeClick]);

  return (
    <>
    <div ref={containerRef} className="relative flex items-center gap-2">
      {/* DOWN - left */}
      <button
        type="button"
        onClick={handleDislikeClick}
        aria-label="Vote no"
        aria-pressed={clicked === "dislike"}
        disabled={votingClosed}
        title={votingClosed ? t("feed.votingClosed") : undefined}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
          clicked === "dislike"
            ? "bg-[var(--blue)] text-white shadow-[var(--shadow-blue)] scale-110"
            : "text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
        }`}
      >
        <BiSolidDislike className="text-[0.9rem]" />
      </button>

      {/* Slider */}
      <div className="relative flex min-w-[4.5rem] flex-1 items-center py-1">
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.58rem] font-bold tabular-nums"
          style={{ color: votingClosed ? "var(--text-gray-light)" : knobColor }}
        >
          {votingClosed ? `${t("feed.votingClosed")} · ${approvalRatio}%` : `${approvalRatio}%`}
        </span>
        <div className="relative h-[3px] w-full rounded-full bg-[rgba(255,255,255,0.1)]">
          {/* Fill - solid color that matches the endpoint position */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${SLIDER_BLUE} 0%, ${knobColor} 100%)`,
            }}
          />
          {/* Knob - glowing dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
            style={{ left: `calc(${Math.min(pct, 100)}% - (${Math.min(pct, 100)} * 14px / 100))` }}
          >
            <div
              className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(255,255,255,0.9)]"
              style={{
                background: knobColor,
                boxShadow:
                  "0 0 6px color-mix(in srgb, var(--pink) 55%, transparent), 0 0 14px color-mix(in srgb, var(--pink) 25%, transparent)",
              }}
            />
          </div>
        </div>
      </div>

      {/* UP - right */}
      <button
        type="button"
        onClick={handleLikeClick}
        aria-label="Vote yes"
        aria-pressed={clicked === "like"}
        disabled={votingClosed}
        title={votingClosed ? t("feed.votingClosed") : undefined}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
          clicked === "like"
            ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)] scale-110"
            : "text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
        }`}
      >
        <BiSolidLike className="text-[0.9rem]" />
      </button>

      {/* Expand chevron */}
      <button
        ref={infoToggleRef}
        type="button"
        onClick={() => (showInfo ? closeInfo() : setShowInfo(true))}
        aria-label={showInfo ? "Hide vote breakdown" : "Show vote breakdown"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
      >
        <IoChevronUp className={`text-[0.8rem] transition-transform ${showInfo ? "rotate-180" : ""}`} />
      </button>

    </div>
    {voteModal}
    </>
  );
}

export default LikesDeslikes;

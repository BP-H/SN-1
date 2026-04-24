"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IoBarChartOutline,
  IoGlobeOutline,
  IoSparklesOutline,
  IoStarOutline,
} from "react-icons/io5";
import { BiSolidLike, BiSolidDislike } from "react-icons/bi";
import { HiOutlinePhoto } from "react-icons/hi2";
import { SearchInputContext } from "@/app/layout";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";
import { useUser } from "@/content/profile/UserContext";
import { buildWeightedVoteSummary } from "@/utils/voteWeights";
import CreatePost from "../create post/CreatePost";
import InputFields from "../create post/InputFields";
import ProposalCard from "../proposal/content/ProposalCard";
import LikesInfo from "../proposal/content/LikesInfo";
import CardLoading from "../CardLoading";

function formatRelativeTime(dateString) {
  if (!dateString) return "now";
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "now";
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return "now";
}

/* Color interpolation for slider (matches LikesDeslikes) */
function getSliderColor(ratio) {
  const t = Math.min(Math.max(ratio / 100, 0), 1);
  const h = 230 + (335 - 230) * t;
  const s = 80 + (100 - 80) * t;
  const l = 75 + (65 - 75) * t;
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

export default function HomeFeed({ setErrorMsg, setNotify, activeBE }) {
  const [discard, setDiscard] = useState(true);

  // Auto-open composer if navigated from a global '+' button click
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("autoOpenComposer") === "true") {
      sessionStorage.removeItem("autoOpenComposer");
      setDiscard(false);
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
    }
  }, []);
  const [showSystemVoteInfo, setShowSystemVoteInfo] = useState(false);
  const [systemVoteClicked, setSystemVoteClicked] = useState(null);
  const { inputRef } = useContext(SearchInputContext);
  const { userData } = useUser();
  const queryClient = useQueryClient();
  const backendUrl = userData?.activeBackend || API_BASE_URL;
  const voterType = userData?.species?.trim() || "human";

  const { data: posts, isLoading } = useQuery({
    queryKey: ["home-feed", activeBE],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/proposals?filter=latest`);
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
    keepPreviousData: true,
  });

  /* The system vote aggregates ALL votes across ALL proposals */
  const systemVote = useMemo(() => {
    const list = posts || [];
    const likes = list.flatMap((post) => post.likes || []);
    const dislikes = list.flatMap((post) => post.dislikes || []);
    const weighted = buildWeightedVoteSummary(likes, dislikes);

    /* Decoupled system vote: We now track the system vote independently of the first post.
       Since there isn't a dedicated endpoint returning the system vote state yet, we aggregate
       all votes to show system health, and store the user's specific system vote locally for UI purposes. */
    let userVote = null;
    if (typeof window !== "undefined" && userData?.name) {
      userVote = localStorage.getItem(`system_vote_${userData.name}`);
    }

    return {
      question: "What should be our next major research focus?",
      yesRatio: Math.round(weighted.supportPercent || 0),
      weighted,
      likes,
      dislikes,
      endsIn: "21h 48m",
      systemId: "system-vote-proxy",
      userVote,
    };
  }, [posts, userData?.name]);

  /* Sync system vote clicked state from data */
  useEffect(() => {
    setSystemVoteClicked(systemVote.userVote);
  }, [systemVote.userVote]);

  /* System vote handler — casts an independent system-level vote */
  const handleSystemVote = async (choice) => {
    if (!userData?.name) {
      setErrorMsg(["Add a display name in your profile before voting."]);
      return;
    }

    const isToggle = systemVoteClicked === choice;

    try {
      if (isToggle) {
        localStorage.removeItem(`system_vote_${userData.name}`);
        setSystemVoteClicked(null);
      } else {
        localStorage.setItem(`system_vote_${userData.name}`, choice);
        setSystemVoteClicked(choice);
        
        // Attempt to cast to a dedicated system endpoint if backend supports it.
        // We catch errors silently to gracefully handle if the backend doesn't have it yet.
        const voteChoice = choice === "like" ? "up" : "down";
        fetch(`${backendUrl}/votes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposal_id: "system-vote-1",
            username: userData.name,
            choice: voteChoice,
            voter_type: voterType,
          }),
        }).catch(() => {});
      }

      // Refetch to update all data
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    } catch (err) {
      setErrorMsg([`System vote failed: ${err.message}`]);
    }
  };

  /* Close system vote overlay on outside click */
  useEffect(() => {
    if (!showSystemVoteInfo) return undefined;
    const close = (e) => {
      if (!e.target.closest("[data-system-vote-overlay]")) setShowSystemVoteInfo(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showSystemVoteInfo]);

  const pct = Math.max(systemVote.weighted.supportPercent || 0, 0);
  const knobColor = getSliderColor(pct);

  return (
    <div className="social-shell px-0 pb-6">
      <CreatePost discard={discard} setDiscard={setDiscard} />

      <div className="space-y-4 pt-2">
        {/* ── System Vote ── */}
        <section className="social-panel max-[480px]:rounded-none max-[480px]:border-x-0 rounded-[1.35rem] px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IoStarOutline className="text-[1rem] text-[var(--pink)]" />
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[var(--pink)]">
                System Vote
              </span>
            </div>
            <span className="text-[0.72rem] text-[var(--text-gray-light)]">
              Ends in {systemVote.endsIn}
            </span>
          </div>
          <p className="mb-4 text-[0.92rem] font-medium text-[var(--text-black)]">
            {systemVote.question}
          </p>

          {/* System vote controls — same style as post action bar */}
          <div className="flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.04)] px-2.5 py-1.5">
            {/* 👎 NO — left */}
            <button
              type="button"
              onClick={() => handleSystemVote("dislike")}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                systemVoteClicked === "dislike"
                  ? "bg-[var(--blue)] text-white shadow-[var(--shadow-blue)] scale-110"
                  : "bg-[rgba(255,255,255,0.08)] text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.14)]"
              }`}
            >
              <BiSolidDislike className="text-[1rem]" />
            </button>

            {/* Slider */}
            <div className="relative flex-1 py-1">
              <span
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[0.6rem] font-bold tabular-nums"
                style={{ color: knobColor }}
              >
                {systemVote.yesRatio}%
              </span>
              <div className="relative h-1 rounded-full bg-[rgba(255,255,255,0.09)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, hsl(230,80%,75%) 0%, ${knobColor} 100%)`,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
                  style={{ left: `calc(${Math.min(pct, 100)}% - (${Math.min(pct, 100)} * 14px / 100))` }}
                >
                  <div
                    className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(255,255,255,0.9)]"
                    style={{
                      background: knobColor,
                      boxShadow: `0 0 6px ${knobColor}, 0 0 14px ${knobColor}40`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 👍 YES — right */}
            <button
              type="button"
              onClick={() => handleSystemVote("like")}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                systemVoteClicked === "like"
                  ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)] scale-110"
                  : "bg-[rgba(255,255,255,0.08)] text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.14)]"
              }`}
            >
              <BiSolidLike className="text-[1rem]" />
            </button>

            {/* Breakdown */}
            <button
              type="button"
              onClick={() => setShowSystemVoteInfo((v) => !v)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.14)]"
              aria-label="Show species vote breakdown"
            >
              <IoBarChartOutline className="text-[0.92rem]" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-[0.72rem] text-[var(--text-gray-light)]">
            <span>NO</span>
            <span>Pass threshold: 60%</span>
            <span>YES</span>
          </div>

          {/* Fullscreen species breakdown overlay */}
          {showSystemVoteInfo && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
              style={{ animation: "fadeSlideIn 0.2s ease-out" }}
              onClick={() => setShowSystemVoteInfo(false)}
            >
              <div
                data-system-vote-overlay
                className="w-full max-w-[28rem]"
                onClick={(e) => e.stopPropagation()}
              >
                <LikesInfo likesData={systemVote.likes} dislikesData={systemVote.dislikes} />
              </div>
            </div>
          )}
        </section>

        {/* ── Create Post ── */}
        {discard ? (
          <section className="social-panel max-[480px]:rounded-none max-[480px]:border-x-0 rounded-[1.35rem] px-4 py-4">
            <div className="mb-3 flex items-center gap-3">
              {userData?.avatar ? (
                <img
                  src={userData.avatar}
                  alt="profile"
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bgGray text-[0.78rem] font-semibold">
                  {(userData?.name || "SN").slice(0, 2).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => setDiscard(false)}
                className="flex-1 rounded-full border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-left text-[0.92rem] text-[var(--text-gray-light)]"
              >
                Share your thoughts...
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[0.72rem] text-[var(--text-gray-light)]">
              <div className="grid min-w-0 flex-1 grid-cols-4 gap-1.5">
                <button type="button" onClick={() => setDiscard(false)} className="flex flex-col items-center gap-1 rounded-[0.9rem] px-1 py-1.5 hover:bg-[rgba(255,255,255,0.04)]">
                  <HiOutlinePhoto className="text-[1rem]" /><span>Media</span>
                </button>
                <button type="button" onClick={() => setDiscard(false)} className="flex flex-col items-center gap-1 rounded-[0.9rem] px-1 py-1.5 hover:bg-[rgba(255,255,255,0.04)]">
                  <IoSparklesOutline className="text-[1rem]" /><span>AI Assist</span>
                </button>
                <button type="button" onClick={() => setDiscard(false)} className="flex flex-col items-center gap-1 rounded-[0.9rem] px-1 py-1.5 hover:bg-[rgba(255,255,255,0.04)]">
                  <IoBarChartOutline className="text-[1rem]" /><span>Poll / Vote</span>
                </button>
                <button type="button" onClick={() => setDiscard(false)} className="flex flex-col items-center gap-1 rounded-[0.9rem] px-1 py-1.5 hover:bg-[rgba(255,255,255,0.04)]">
                  <IoGlobeOutline className="text-[1rem]" /><span>Space</span>
                </button>
              </div>
              <button type="button" onClick={() => setDiscard(false)} className="shrink-0 rounded-full bg-[var(--pink)] px-4 py-2 text-[0.82rem] font-semibold text-white shadow-[var(--shadow-pink)]">
                Post
              </button>
            </div>
          </section>
        ) : (
          <section ref={inputRef} className="social-panel max-[480px]:rounded-none max-[480px]:border-x-0 rounded-[1.35rem] px-4 py-4">
            <InputFields embedded autoFocus setDiscard={setDiscard} />
          </section>
        )}

        {/* ── Feed ── */}
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <CardLoading key={index} />)
          ) : (
            (posts || []).map((post) => (
              <ProposalCard
                key={post.id}
                id={post.id}
                userName={post.userName}
                userInitials={post.userInitials}
                time={formatRelativeTime(post.time)}
                title={post.title}
                logo={post.author_img}
                media={{
                  image: post.media?.image ? absoluteApiUrl(post.media.image) : post.image ? absoluteApiUrl(post.image) : "",
                  video: post.media?.video || post.video || "",
                  link: post.media?.link || post.link || "",
                  file: post.media?.file ? absoluteApiUrl(post.media.file) : post.file ? absoluteApiUrl(post.file) : "",
                }}
                text={post.text}
                comments={post.comments}
                likes={post.likes}
                dislikes={post.dislikes}
                setErrorMsg={setErrorMsg}
                setNotify={setNotify}
                specie={post.author_type}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

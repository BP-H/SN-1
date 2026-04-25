"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  IoDocumentTextOutline,
  IoImageOutline,
  IoSend,
  IoVideocamOutline,
} from "react-icons/io5";
import { SearchInputContext } from "@/app/layout";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";
import { avatarDisplayUrl } from "@/utils/avatar";
import { useUser } from "@/content/profile/UserContext";
import CreatePost from "../create post/CreatePost";
import InputFields from "../create post/InputFields";
import CardLoading from "../CardLoading";
import FilterHeader from "../filters/FilterHeader";
import ProposalCard from "./content/ProposalCard";

const PROPOSAL_PAGE_SIZE = 30;

function formatRelativeTime(dateString) {
  if (!dateString) return "now";

  const now = new Date();
  const raw = String(dateString);
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return "now";
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return "now";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSec >= 10 && diffSec < 60) return `${diffSec}s`;
  if (diffYears > 0) return diffYears === 1 ? "1y" : `${diffYears}y`;
  if (diffMonths > 0) return diffMonths === 1 ? "1mo" : `${diffMonths}mo`;
  if (diffDays > 0) return diffDays === 1 ? "1d" : `${diffDays}d`;
  if (diffHours > 0) return diffHours === 1 ? "1h" : `${diffHours}h`;
  if (diffMin > 0) return diffMin === 1 ? "1min" : `${diffMin}min`;
  return "now";
}

export default function Proposal({ activeBE, setErrorMsg, setNotify }) {
  const [discard, setDiscard] = useState(true);
  const [pendingMediaPicker, setPendingMediaPicker] = useState("");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { inputRef } = useContext(SearchInputContext);
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const userAvatar = isAuthenticated ? avatarDisplayUrl(userData?.avatar, defaultAvatar) : defaultAvatar;

  const requireAccount = (message) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create", reason: message } }));
    }
  };

  const openComposerWithMedia = (type) => {
    if (!isAuthenticated) {
      requireAccount("Sign in to attach media and post on SuperNova.");
      return;
    }
    setPendingMediaPicker(type);
    setDiscard(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = (params.get("filter") || "").toLowerCase();
    const nextFilter =
      filterParam === "ai"
        ? "AI"
        : filterParam === "company" || filterParam === "org"
        ? "Company"
        : filterParam === "human"
        ? "Human"
        : "";
    if (nextFilter) setFilter(nextFilter);
  }, []);

  const {
    data: postsData,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["proposals", filter, search, activeBE],
    queryFn: async ({ pageParam = 0 }) => {
      const filterMap = {
        All: "all",
        Latest: "latest",
        Oldest: "oldest",
        "Top Liked": "topLikes",
        "Less Liked": "fewestLikes",
        Popular: "popular",
        AI: "ai",
        Company: "company",
        Organization: "company",
        ORG: "company",
        Human: "human",
      };

      const filterParam = filterMap[filter];
      let url = `${API_BASE_URL}/proposals?filter=${filterParam}&limit=${PROPOSAL_PAGE_SIZE}&offset=${pageParam}`;
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      return response.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!Array.isArray(lastPage) || lastPage.length < PROPOSAL_PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + (Array.isArray(page) ? page.length : 0), 0);
    },
  });
  const posts = useMemo(() => postsData?.pages?.flat() || [], [postsData]);

  return (
    <div className="social-shell px-0">
      <div className="flex min-w-0 flex-col gap-2.5">
        <FilterHeader setSearch={setSearch} search={search} filter={filter} setFilter={setFilter} />

        <CreatePost discard={discard} setDiscard={setDiscard} />

        <section ref={inputRef} className="mobile-feed-panel social-panel overflow-hidden rounded-[1.35rem] px-4 py-4 transition-all duration-300 ease-out">
          {discard ? (
            <div className="flex items-center gap-2.5">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt="profile"
                  onError={(event) => {
                    event.currentTarget.src = defaultAvatar;
                  }}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bgGray text-[0.72rem] font-semibold">
                  {(userData?.name || "SN").slice(0, 2).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    requireAccount("Sign in to post on SuperNova.");
                    return;
                  }
                  setDiscard(false);
                }}
                className="min-w-0 flex-1 rounded-full border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5 text-left text-[0.88rem] text-[var(--text-gray-light)]"
              >
                Share your thoughts...
              </button>

              <div className="flex shrink-0 items-center gap-1.5 text-[var(--text-gray-light)]">
                <button
                  type="button"
                  onClick={() => openComposerWithMedia("image")}
                  className="composer-icon-button flex h-9 w-9 items-center justify-center rounded-full"
                  aria-label="Add media"
                >
                  <IoImageOutline className="text-[1rem]" />
                </button>
                <button
                  type="button"
                  onClick={() => openComposerWithMedia("video")}
                  className="composer-icon-button flex h-9 w-9 items-center justify-center rounded-full"
                  aria-label="Add video"
                >
                  <IoVideocamOutline className="text-[1rem]" />
                </button>
                <button
                  type="button"
                  onClick={() => openComposerWithMedia("file")}
                  className="composer-icon-button flex h-9 w-9 items-center justify-center rounded-full"
                  aria-label="Add document"
                >
                  <IoDocumentTextOutline className="text-[1rem]" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      requireAccount("Sign in to post on SuperNova.");
                      return;
                    }
                    setDiscard(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                  aria-label="Post"
                  title="Post"
                >
                  <IoSend className="text-[1rem]" />
                </button>
              </div>
            </div>
          ) : (
            <InputFields
              embedded
              autoFocus
              setDiscard={setDiscard}
              autoOpenMediaType={pendingMediaPicker}
              onAutoOpenConsumed={() => setPendingMediaPicker("")}
            />
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-2.5 pb-24">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <CardLoading key={index} />)
          ) : isError ? (
            <div className="mobile-feed-panel social-panel rounded-[28px] px-6 py-10 text-center text-[0.86rem] text-[var(--text-gray-light)]">
              <p className="font-semibold text-[var(--text-black)]">Could not load proposals.</p>
              <p className="mt-1">{error?.message || "The backend did not return posts."}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 rounded-full bg-[var(--pink)] px-4 py-2 text-[0.78rem] font-bold text-white shadow-[var(--shadow-pink)]"
              >
                Retry
              </button>
            </div>
          ) : posts.length > 0 ? (
            <>
              {posts.map((post) => (
                <ProposalCard
                  key={post.id}
                  id={post.id}
                  userName={post.userName}
                  userInitials={post.userInitials}
                  time={formatRelativeTime(post.time)}
                  title={post.title}
                  logo={post.author_img}
                  media={{
                    image: post.media?.image
                      ? absoluteApiUrl(post.media.image)
                      : post.image
                      ? absoluteApiUrl(post.image)
                      : "",
                    images: Array.isArray(post.media?.images)
                      ? post.media.images.map((image) => absoluteApiUrl(image))
                      : [],
                    layout: post.media?.layout || "carousel",
                    governance: post.media?.governance || null,
                    video: post.media?.video || post.video || "",
                    link: post.media?.link || post.link || "",
                    file: post.media?.file
                      ? absoluteApiUrl(post.media.file)
                      : post.file
                      ? absoluteApiUrl(post.file)
                      : "",
                  }}
                  text={post.text}
                  comments={post.comments}
                  likes={post.likes}
                  dislikes={post.dislikes}
                  setErrorMsg={setErrorMsg}
                  setNotify={setNotify}
                  specie={post.author_type}
                  activeBE={activeBE}
                />
              ))}
              {hasNextPage && (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-3 text-center text-[0.86rem] font-bold text-[var(--text-black)] disabled:opacity-60"
                >
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </button>
              )}
            </>
          ) : (
            <div className="mobile-feed-panel social-panel rounded-[28px] px-6 py-10 text-center font-semibold text-gray-500">
              No proposals found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

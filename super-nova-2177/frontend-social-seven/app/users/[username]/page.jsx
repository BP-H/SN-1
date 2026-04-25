"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { IoArrowBack, IoChatbubbleEllipsesOutline } from "react-icons/io5";
import Error from "@/content/Error";
import Notification from "@/content/Notification";
import ProposalCard from "@/content/proposal/content/ProposalCard";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";

const USER_POST_PAGE_SIZE = 30;

function avatarUrl(value) {
  return normalizeAvatarValue(value) ? avatarDisplayUrl(value) : "";
}

function formatRelativeTime(dateString) {
  if (!dateString) return "now";
  const raw = String(dateString);
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return "now";
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSec >= 10 && diffSec < 60) return `${diffSec}s`;
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return "now";
}

export default function UserPostsPage() {
  const params = useParams();
  const router = useRouter();
  const username = decodeURIComponent(params?.username || "");
  const [errorMsg, setErrorMsg] = useState([]);
  const [notify, setNotify] = useState([]);

  const profileQuery = useQuery({
    queryKey: ["public-profile", username],
    enabled: Boolean(username),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(username)}`);
      if (!response.ok) throw new Error("Failed to load profile");
      return response.json();
    },
  });

  const postsQuery = useInfiniteQuery({
    queryKey: ["user-posts", username],
    enabled: Boolean(username),
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `${API_BASE_URL}/proposals?filter=latest&author=${encodeURIComponent(username)}&limit=${USER_POST_PAGE_SIZE}&offset=${pageParam}`
      );
      if (!response.ok) throw new Error("Failed to load posts");
      return response.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!Array.isArray(lastPage) || lastPage.length < USER_POST_PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + (Array.isArray(page) ? page.length : 0), 0);
    },
  });

  const usersQuery = useQuery({
    queryKey: ["social-users-profile-fallback", username],
    enabled: Boolean(username),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/social-users?username=${encodeURIComponent(username)}&limit=80`);
      if (!response.ok) throw new Error("Failed to load users");
      return response.json();
    },
  });

  const posts = useMemo(() => {
    return (postsQuery.data?.pages?.flat() || []).filter(
      (post) => post.userName?.toLowerCase() === username.toLowerCase()
    );
  }, [postsQuery.data, username]);

  const profile = profileQuery.data || {};
  const socialUser = (usersQuery.data || []).find((user) => user.username?.toLowerCase() === username.toLowerCase());
  const firstPost = posts[0];
  const image = avatarUrl(profile.avatar_url || socialUser?.avatar || firstPost?.author_img);

  return (
    <div className="social-shell px-0 pb-6">
      {errorMsg.length > 0 && <Error messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}

      <section className="mobile-feed-panel social-panel rounded-[1rem] px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-[var(--text-gray-light)]"
            aria-label="Go back"
          >
            <IoArrowBack />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/messages?to=${encodeURIComponent(username)}`)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
            aria-label={`Message ${username}`}
          >
            <IoChatbubbleEllipsesOutline />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {image ? (
            <img src={image} alt="" className="h-16 w-16 rounded-full object-cover shadow-[var(--shadow-pink)]" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bgGray text-lg font-black">
              {(username || "SN").slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.15rem] font-black">{profile.username || username}</h1>
            <p className="mt-1 line-clamp-2 text-[0.82rem] leading-5 text-[var(--text-gray-light)]">
              {profile.bio || "Explorer of superNova_2177."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Posts", posts.length],
            ["Species", profile.species || "human"],
            ["Harmony", Math.round(profile.harmony_score || 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[0.8rem] bg-white/[0.045] px-2 py-2">
              <p className="text-[0.86rem] font-bold text-[var(--text-black)]">{value}</p>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-[var(--text-gray-light)]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-2.5 flex flex-col gap-2.5">
        {postsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="load mx-[0.35rem] h-40 rounded-[1rem]" />
          ))
        ) : postsQuery.isError ? (
          <div className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-8 text-center text-[0.86rem] text-[var(--text-gray-light)]">
            <p className="font-semibold text-[var(--text-black)]">Could not load posts.</p>
            <p className="mt-1">{postsQuery.error?.message || "The backend did not return posts."}</p>
            <button
              type="button"
              onClick={() => postsQuery.refetch()}
              className="mt-4 rounded-full bg-[var(--pink)] px-4 py-2 text-[0.78rem] font-bold text-white shadow-[var(--shadow-pink)]"
            >
              Retry
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-8 text-center text-[0.86rem] text-[var(--text-gray-light)]">
            No posts from this user yet.
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <ProposalCard
                key={post.id}
                id={post.id}
                userName={post.userName}
                userInitials={post.userInitials}
                time={formatRelativeTime(post.time)}
                title={post.title}
                text={post.text}
                logo={post.author_img}
                media={post.media}
                comments={post.comments}
                likes={post.likes}
                dislikes={post.dislikes}
                specie={post.author_type}
                setErrorMsg={setErrorMsg}
                setNotify={setNotify}
              />
            ))}
            {postsQuery.hasNextPage && (
              <button
                type="button"
                onClick={() => postsQuery.fetchNextPage()}
                disabled={postsQuery.isFetchingNextPage}
                className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-3 text-center text-[0.86rem] font-bold text-[var(--text-black)] disabled:opacity-60"
              >
                {postsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

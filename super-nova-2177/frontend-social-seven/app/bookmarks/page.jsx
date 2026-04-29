"use client";

import { useCallback, useEffect, useState } from "react";
import { IoBookmarkOutline, IoRefreshOutline } from "react-icons/io5";
import ErrorBanner from "@/content/Error";
import Notification from "@/content/Notification";
import ProposalCard from "@/content/proposal/content/ProposalCard";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";
import { BOOKMARK_STORAGE_KEY, BOOKMARKS_CHANGED_EVENT, readBookmarkIds } from "@/utils/bookmarks";

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

function mapPostMedia(post) {
  return {
    image: post.media?.image ? absoluteApiUrl(post.media.image) : post.image ? absoluteApiUrl(post.image) : "",
    images: Array.isArray(post.media?.images) ? post.media.images.map((image) => absoluteApiUrl(image)) : [],
    layout: post.media?.layout || "carousel",
    governance: post.media?.governance || null,
    video: post.media?.video || post.video || "",
    link: post.media?.link || post.link || "",
    file: post.media?.file ? absoluteApiUrl(post.media.file) : post.file ? absoluteApiUrl(post.file) : "",
  };
}

export default function BookmarksPage() {
  const [bookmarkIds, setBookmarkIds] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [errorMsg, setErrorMsg] = useState([]);
  const [notify, setNotify] = useState([]);

  const loadSavedPosts = useCallback(async () => {
    const ids = readBookmarkIds();
    setBookmarkIds(ids);
    setFetchError("");

    if (ids.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`${API_BASE_URL}/proposals/${encodeURIComponent(id)}`);
          if (!response.ok) return null;
          return response.json();
        })
      );
      setPosts(results.filter(Boolean));
    } catch (error) {
      setFetchError(error?.message || "Could not load saved posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedPosts();
  }, [loadSavedPosts]);

  useEffect(() => {
    const handleBookmarksChanged = () => loadSavedPosts();
    const handleStorage = (event) => {
      if (event.key === BOOKMARK_STORAGE_KEY) loadSavedPosts();
    };

    window.addEventListener(BOOKMARKS_CHANGED_EVENT, handleBookmarksChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, handleBookmarksChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadSavedPosts]);

  return (
    <main className="social-shell mx-auto flex min-h-screen w-full max-w-[44rem] flex-col gap-4 px-3 pb-28 pt-4 text-[var(--text-black)] md:px-5">
      {errorMsg.length > 0 && <ErrorBanner messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}

      <section className="mobile-feed-panel social-panel rounded-[1.25rem] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-[var(--pink)]">
              <IoBookmarkOutline />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[1rem] font-black">Saved posts</h1>
              <p className="mt-0.5 text-[0.78rem] text-[var(--text-gray-light)]">
                {bookmarkIds.length ? `${bookmarkIds.length} saved` : "Posts you save from the 3-dot menu live here."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadSavedPosts}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-[var(--text-gray-light)] transition hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-[var(--pink)] disabled:opacity-50"
            aria-label="Refresh saved posts"
          >
            <IoRefreshOutline />
          </button>
        </div>
      </section>

      {fetchError && (
        <section className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-5 text-[0.86rem] text-[var(--text-gray-light)]">
          <p className="font-semibold text-[var(--text-black)]">Saved posts could not load.</p>
          <p className="mt-1">{fetchError}</p>
        </section>
      )}

      {loading ? (
        <section className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-8 text-center text-[0.86rem] text-[var(--text-gray-light)]">
          Loading saved posts...
        </section>
      ) : posts.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-2.5">
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
              media={mapPostMedia(post)}
              comments={post.comments}
              collabs={post.collabs}
              likes={post.likes}
              dislikes={post.dislikes}
              profileUrl={post.profile_url}
              domainAsProfile={post.domain_as_profile}
              specie={post.author_type}
              setErrorMsg={setErrorMsg}
              setNotify={setNotify}
            />
          ))}
        </div>
      ) : (
        <section className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-8 text-center text-[0.86rem] text-[var(--text-gray-light)]">
          {bookmarkIds.length ? "Saved posts are no longer available." : "No saved posts yet."}
        </section>
      )}
    </main>
  );
}

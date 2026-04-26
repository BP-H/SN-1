"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IoChatbubbleEllipsesOutline,
  IoCheckmark,
  IoClose,
  IoCreateOutline,
  IoGlobeOutline,
  IoLinkOutline,
  IoPersonAddOutline,
  IoPersonRemoveOutline,
} from "react-icons/io5";
import Error from "@/content/Error";
import Notification from "@/content/Notification";
import ProposalCard from "@/content/proposal/content/ProposalCard";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";
import LinkifiedText, { normalizeLinkHref } from "@/utils/linkify";
import { speciesAvatarStyle } from "@/utils/species";
import { useUser } from "@/content/profile/UserContext";

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
  const queryClient = useQueryClient();
  const username = decodeURIComponent(params?.username || "");
  const { userData, isAuthenticated, defaultAvatar } = useUser();
  const [errorMsg, setErrorMsg] = useState([]);
  const [notify, setNotify] = useState([]);
  const [followBusy, setFollowBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [domainDraft, setDomainDraft] = useState("");
  const [domainAsProfileDraft, setDomainAsProfileDraft] = useState(false);
  const currentUsername = userData?.name || "";
  const isOwnProfile = Boolean(
    currentUsername && username && currentUsername.toLowerCase() === username.toLowerCase()
  );

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

  const followQuery = useQuery({
    queryKey: ["profile-follow-status", currentUsername, username],
    enabled: Boolean(isAuthenticated && currentUsername && username && !isOwnProfile),
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/follows/status?follower=${encodeURIComponent(currentUsername)}&target=${encodeURIComponent(username)}`
      );
      if (!response.ok) throw new Error("Failed to load follow status");
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
  const profileSpecies = profile.species || socialUser?.species || firstPost?.author_type || "human";
  const profileAvatarStyle = speciesAvatarStyle(profileSpecies, "strong");
  const image = avatarUrl(profile.avatar_url || socialUser?.avatar || firstPost?.author_img);
  const publicDomain = profile.domain_url || socialUser?.domain_url || "";
  const domainAsProfile = Boolean((profile.domain_as_profile || socialUser?.domain_as_profile) && publicDomain);
  const profileTargetUrl = domainAsProfile ? normalizeLinkHref(publicDomain) : "";
  const following = Boolean(followQuery.data?.following);
  const harmonyScore = Math.round(Number(profile.harmony_score ?? profile.karma ?? 0) || 0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const scrollProfileTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.querySelector(".app-shell")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    };
    scrollProfileTop();
    const frame = window.requestAnimationFrame(scrollProfileTop);
    const timer = window.setTimeout(scrollProfileTop, 60);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [username]);

  useEffect(() => {
    setAboutDraft(profile.bio || "");
    setDomainDraft(profile.domain_url || "");
    setDomainAsProfileDraft(Boolean(profile.domain_as_profile));
  }, [profile.bio, profile.domain_as_profile, profile.domain_url]);

  const requireAccount = () => {
    window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
  };

  const handleMessage = () => {
    if (!isAuthenticated || !currentUsername) {
      requireAccount();
      return;
    }
    if (!username || isOwnProfile) return;
    router.push(`/messages?to=${encodeURIComponent(username)}`);
  };

  const handleToggleFollow = async () => {
    if (!isAuthenticated || !currentUsername) {
      requireAccount();
      return;
    }
    if (!username || isOwnProfile || followBusy) return;
    setFollowBusy(true);
    setErrorMsg([]);
    try {
      const response = await fetch(
        following
          ? `${API_BASE_URL}/follows?follower=${encodeURIComponent(currentUsername)}&target=${encodeURIComponent(username)}`
          : `${API_BASE_URL}/follows`,
        {
          method: following ? "DELETE" : "POST",
          headers: following ? undefined : { "Content-Type": "application/json" },
          body: following ? undefined : JSON.stringify({ follower: currentUsername, target: username }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || "Follow action failed.");
      setNotify([payload.following ? `Following ${username}.` : `Unfollowed ${username}.`]);
      queryClient.invalidateQueries({ queryKey: ["profile-follow-status", currentUsername, username] });
      queryClient.invalidateQueries({ queryKey: ["public-profile", username] });
      queryClient.invalidateQueries({ queryKey: ["home-following"] });
      queryClient.invalidateQueries({ queryKey: ["desktop-social-graph"] });
      queryClient.invalidateQueries({ queryKey: ["universe-social-graph"] });
    } catch (error) {
      setErrorMsg([error.message || "Follow action failed."]);
    } finally {
      setFollowBusy(false);
    }
  };

  const handleSaveProfileDetails = async () => {
    if (!isOwnProfile || !currentUsername) return;
    setProfileSaveBusy(true);
    setErrorMsg([]);
    try {
      const response = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(currentUsername)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: aboutDraft.trim(),
          domain_url: domainDraft.trim(),
          domain_as_profile: Boolean(domainAsProfileDraft && domainDraft.trim()),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || "Unable to update profile.");
      setNotify(["Profile details updated."]);
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["public-profile", username] });
      queryClient.invalidateQueries({ queryKey: ["social-users-profile-fallback", username] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    } catch (error) {
      setErrorMsg([error.message || "Unable to update profile."]);
    } finally {
      setProfileSaveBusy(false);
    }
  };

  const avatarNode = image ? (
    <img
      src={image}
      alt=""
      onError={(event) => {
        event.currentTarget.src = defaultAvatar;
      }}
      className="h-20 w-20 rounded-full border object-cover"
      style={profileAvatarStyle}
    />
  ) : (
    <span className="flex h-20 w-20 items-center justify-center rounded-full border bgGray text-xl font-black" style={profileAvatarStyle}>
      {(username || "SN").slice(0, 2).toUpperCase()}
    </span>
  );

  return (
    <div className="social-shell px-0 pb-6">
      {errorMsg.length > 0 && <Error messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}

      <section className="mobile-feed-panel social-panel rounded-[1rem] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          {profileTargetUrl ? (
            <a href={profileTargetUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Open profile domain">
              {avatarNode}
            </a>
          ) : (
            <div className="shrink-0">{avatarNode}</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.15rem] font-black">{profile.username || username}</h1>
            <p className="mt-1 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--text-gray-light)]">
              {profileSpecies} node
            </p>
            {publicDomain && (
              <a
                href={normalizeLinkHref(publicDomain)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/[0.055] px-2.5 py-1 text-[0.7rem] font-semibold text-[var(--text-gray-light)] hover:text-[var(--pink)]"
              >
                <IoGlobeOutline className="shrink-0" />
                <span className="truncate">{publicDomain.replace(/^https?:\/\//i, "")}</span>
              </a>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => setEditOpen((value) => !value)}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  editOpen
                    ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                    : "bg-white/[0.06] text-[var(--text-gray-light)] hover:text-[var(--pink)]"
                }`}
                aria-label="Edit profile details"
              >
                <IoCreateOutline />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleMessage}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                  aria-label={`Message ${username}`}
                >
                  <IoChatbubbleEllipsesOutline />
                </button>
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={followBusy}
                  className={`flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-50 ${
                    following
                      ? "bg-white/[0.1] text-[var(--pink)]"
                      : "bg-white/[0.06] text-[var(--text-gray-light)] hover:text-[var(--pink)]"
                  }`}
                  aria-label={following ? `Unfollow ${username}` : `Follow ${username}`}
                >
                  {following ? <IoPersonRemoveOutline /> : <IoPersonAddOutline />}
                </button>
              </>
            )}
          </div>
        </div>

        {(profile.bio || editOpen) && (
          <div className="mt-4 rounded-[0.9rem] bg-white/[0.035] px-3 py-3 text-[0.84rem] leading-5 text-[var(--transparent-black)]">
            {profile.bio ? <LinkifiedText text={profile.bio} /> : <span className="text-[var(--text-gray-light)]">Add an about section.</span>}
          </div>
        )}

        {editOpen && (
          <div className="mt-4 grid gap-2 rounded-[1rem] border border-[var(--horizontal-line)] bg-white/[0.035] p-3">
            <textarea
              value={aboutDraft}
              onChange={(event) => setAboutDraft(event.target.value)}
              rows={4}
              maxLength={500}
              className="auth-input min-h-24 resize-y rounded-[0.9rem] px-3 py-3 text-[0.86rem] outline-none"
              placeholder="About you, your AI, or your ORG. Links become clickable."
            />
            <div className="flex items-center gap-2 rounded-[0.9rem] border border-[var(--horizontal-line)] bg-black/10 px-3 py-2">
              <IoLinkOutline className="shrink-0 text-[var(--pink)]" />
              <input
                value={domainDraft}
                onChange={(event) => setDomainDraft(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[0.84rem] outline-none placeholder:text-[var(--text-gray-light)]"
                placeholder="yourdomain.com or https://yourdomain.com"
              />
            </div>
            <button
              type="button"
              onClick={() => setDomainAsProfileDraft((value) => !value)}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-[0.9rem] px-3 py-2 text-left text-[0.78rem] font-semibold ${
                domainAsProfileDraft
                  ? "bg-[rgba(255,79,149,0.16)] text-[var(--text-black)] shadow-[var(--shadow-pink)]"
                  : "bg-white/[0.055] text-[var(--text-gray-light)]"
              }`}
              role="switch"
              aria-checked={domainAsProfileDraft}
            >
              <span className="flex min-w-0 items-center gap-2">
                <IoGlobeOutline className="shrink-0 text-[var(--pink)]" />
                <span className="min-w-0">Profile photo opens domain</span>
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full border border-[var(--horizontal-line)] ${
                  domainAsProfileDraft ? "bg-[var(--pink)]" : "bg-black/15"
                }`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm ${
                    domainAsProfileDraft ? "left-[1.45rem]" : "left-1"
                  }`}
                />
              </span>
            </button>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setAboutDraft(profile.bio || "");
                  setDomainDraft(profile.domain_url || "");
                  setDomainAsProfileDraft(Boolean(profile.domain_as_profile));
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.055] text-[var(--text-gray-light)]"
                aria-label="Cancel profile edit"
              >
                <IoClose />
              </button>
              <button
                type="button"
                onClick={handleSaveProfileDetails}
                disabled={profileSaveBusy}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)] disabled:opacity-55"
                aria-label="Save profile details"
              >
                <IoCheckmark />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Posts", posts.length],
            ["Species", profileSpecies],
            ["Harmony", harmonyScore],
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
                profileUrl={post.profile_url}
                domainAsProfile={post.domain_as_profile}
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

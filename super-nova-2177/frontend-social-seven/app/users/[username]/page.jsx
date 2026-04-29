"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IoChatbubbleEllipsesOutline,
  IoCheckmark,
  IoClose,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoGlobeOutline,
  IoGridOutline,
  IoLinkOutline,
  IoPeopleOutline,
  IoPersonAddOutline,
  IoPersonRemoveOutline,
  IoTextOutline,
} from "react-icons/io5";
import ErrorBanner from "@/content/Error";
import Notification from "@/content/Notification";
import ProposalCard from "@/content/proposal/content/ProposalCard";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";
import { BACKEND_AUTH_MISSING_MESSAGE, authHeaders, requireBackendAuthSession } from "@/utils/authSession";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";
import LinkifiedText, { normalizeLinkHref } from "@/utils/linkify";
import { speciesAvatarStyle } from "@/utils/species";
import { useVerifiedMentionUsernames } from "@/utils/verifiedMentions";
import { useUser } from "@/content/profile/UserContext";

const USER_POST_PAGE_SIZE = 30;
const PROFILE_TABS = [
  { key: "visuals", label: "Visuals", title: "Visual posts", icon: IoGridOutline },
  { key: "proposals", label: "Proposals", title: "Proposals", icon: IoDocumentTextOutline },
  { key: "text", label: "Text", title: "Text posts", icon: IoTextOutline },
];

function avatarUrl(value) {
  return normalizeAvatarValue(value) ? avatarDisplayUrl(value) : "";
}

function mediaUrl(value) {
  const normalized = normalizeAvatarValue(value);
  if (!normalized) return "";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
  return absoluteApiUrl(normalized);
}

function getYouTubeId(url) {
  if (!url) return "";
  const match = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] || "";
}

function getVisualMeta(post) {
  const media = post?.media || {};
  const images = Array.isArray(media.images) ? media.images.filter(Boolean) : [];
  const firstImage = images[0] || media.image || "";
  if (firstImage) {
    return {
      kind: "image",
      src: mediaUrl(firstImage),
      count: Math.max(images.length, firstImage ? 1 : 0),
    };
  }

  const youtubeId = getYouTubeId(media.video || media.link);
  if (youtubeId) {
    return {
      kind: "video",
      src: `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`,
      fallbackSrc: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      count: 1,
    };
  }

  if (media.video) {
    return {
      kind: "video",
      src: "",
      videoSrc: mediaUrl(media.video),
      count: 1,
    };
  }

  return null;
}

function ProfileVisualTile({ post, visual, onOpen, isCollab = false }) {
  const [thumbnailSrc, setThumbnailSrc] = useState(visual?.src || "");
  const [thumbnailFailed, setThumbnailFailed] = useState(!visual?.src);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setThumbnailSrc(visual?.src || "");
    setThumbnailFailed(!visual?.src);
    setVideoFailed(false);
  }, [visual?.src, visual?.videoSrc]);

  const fallbackLabel = visual?.kind === "video" ? "Video" : "Media";
  const likeCount = Array.isArray(post?.likes) ? post.likes.length : 0;
  const dislikeCount = Array.isArray(post?.dislikes) ? post.dislikes.length : 0;
  const hasVoteSignal = likeCount > 0 || dislikeCount > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square min-w-0 overflow-hidden rounded-[0.65rem] border border-white/[0.06] bg-white/[0.045] text-left shadow-sm"
      aria-label={`Open ${post.title || "profile post"}`}
    >
      {thumbnailSrc && !thumbnailFailed ? (
        <img
          src={thumbnailSrc}
          alt=""
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          onError={() => {
            if (visual?.fallbackSrc && thumbnailSrc !== visual.fallbackSrc) {
              setThumbnailSrc(visual.fallbackSrc);
              return;
            }
            setThumbnailFailed(true);
          }}
        />
      ) : visual?.kind === "video" && visual?.videoSrc && !videoFailed ? (
        <video
          src={visual.videoSrc}
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-white/[0.035] px-2 text-center text-[0.72rem] font-bold text-[var(--text-gray-light)]">
          {fallbackLabel}
        </span>
      )}
      {visual?.count > 1 && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
          {visual.count}
        </span>
      )}
      {visual?.kind === "video" && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
          Video
        </span>
      )}
      {isCollab && (
        <span className="profile-visual-collab-badge absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em]">
          Collab
        </span>
      )}
      {hasVoteSignal && (
        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
          {likeCount}+ {dislikeCount}-
        </span>
      )}
    </button>
  );
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

function collabUserLabel(user) {
  const username = String(user?.username || "").trim();
  return username ? `@${username}` : "Unknown user";
}

function CollabUserAvatar({ user }) {
  const [failed, setFailed] = useState(false);
  const avatar = failed ? "" : avatarUrl(user?.avatar || user?.avatar_url || user?.profile_pic);
  const initials = String(user?.username || "SN").slice(0, 2).toUpperCase();

  return avatar ? (
    <img
      src={avatar}
      alt=""
      className="h-9 w-9 rounded-full border border-white/10 object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-[0.72rem] font-black text-[var(--text-black)]">
      {initials}
    </span>
  );
}

async function fetchProfilePostsPage(username, pageParam) {
  const baseUrl = `${API_BASE_URL}/proposals?filter=latest&author=${encodeURIComponent(username)}&limit=${USER_POST_PAGE_SIZE}&offset=${pageParam}`;
  let withCollabs = null;
  try {
    withCollabs = await fetch(`${baseUrl}&include_collabs=true`);
  } catch {
    withCollabs = null;
  }
  if (withCollabs?.ok) {
    const payload = await withCollabs.json().catch(() => []);
    return Array.isArray(payload) ? payload : [];
  }

  let authorOnly = null;
  try {
    authorOnly = await fetch(baseUrl);
  } catch {
    throw new Error("Failed to load posts");
  }
  if (authorOnly.ok) {
    const payload = await authorOnly.json().catch(() => []);
    return Array.isArray(payload) ? payload : [];
  }

  const errorPayload = await authorOnly.json().catch(() => ({}));
  throw new Error(errorPayload?.detail || "Failed to load posts");
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
  const [activeTab, setActiveTab] = useState("visuals");
  const [collabPanelOpen, setCollabPanelOpen] = useState(false);
  const [collabReviewBusyId, setCollabReviewBusyId] = useState("");
  const [collabPanelNotice, setCollabPanelNotice] = useState("");
  const [collabPanelError, setCollabPanelError] = useState("");
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
    queryKey: ["user-posts", username, "include-collabs"],
    enabled: Boolean(username),
    queryFn: async ({ pageParam = 0 }) => {
      return fetchProfilePostsPage(username, pageParam);
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
        `${API_BASE_URL}/follows/status?follower=${encodeURIComponent(currentUsername)}&target=${encodeURIComponent(username)}`,
        { headers: authHeaders() }
      );
      if (!response.ok) throw new Error("Failed to load follow status");
      return response.json();
    },
  });

  const collabRequestsQuery = useQuery({
    queryKey: ["proposal-collabs", currentUsername, "pending"],
    enabled: Boolean(isAuthenticated && currentUsername),
    queryFn: async () => {
      requireBackendAuthSession();
      const fetchRole = async (role) => {
        const response = await fetch(`${API_BASE_URL}/proposal-collabs?role=${role}&status=pending&limit=50`, {
          headers: authHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.detail || "Unable to load collab requests.");
        return Array.isArray(payload?.collabs) ? payload.collabs : [];
      };
      const [incoming, outgoing] = await Promise.all([fetchRole("collaborator"), fetchRole("author")]);
      return { incoming, outgoing };
    },
    staleTime: 30000,
  });

  const posts = useMemo(() => {
    const seen = new Set();
    return (postsQuery.data?.pages?.flat() || []).filter((post) => {
      const key = post?.id ?? `${post?.userName || "post"}-${post?.title || ""}-${post?.time || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [postsQuery.data]);
  const visualPosts = useMemo(
    () => posts.map((post) => ({ post, visual: getVisualMeta(post) })).filter((item) => item.visual),
    [posts]
  );
  const textPosts = useMemo(
    () => posts.filter((post) => !getVisualMeta(post)),
    [posts]
  );
  const tabCounts = useMemo(
    () => ({
      visuals: visualPosts.length,
      proposals: posts.length,
      text: textPosts.length,
    }),
    [posts.length, textPosts.length, visualPosts.length]
  );

  const profile = profileQuery.data || {};
  const verifiedBioMentions = useVerifiedMentionUsernames(profile.bio || "");
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
  const collabIncoming = collabRequestsQuery.data?.incoming || [];
  const collabOutgoing = collabRequestsQuery.data?.outgoing || [];
  const pendingCollabCount = collabIncoming.length + collabOutgoing.length;

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
    setActiveTab("visuals");
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
          headers: following ? authHeaders() : authHeaders({ "Content-Type": "application/json" }),
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
        headers: authHeaders({ "Content-Type": "application/json" }),
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

  const handleOpenProfileDomain = () => {
    if (!profileTargetUrl || typeof window === "undefined") return;
    window.open(profileTargetUrl, "_blank", "noopener,noreferrer");
  };

  const openProposal = (proposalId) => {
    if (proposalId === undefined || proposalId === null || proposalId === "") {
      router.push("/proposals");
      return;
    }
    router.push(`/proposals/${encodeURIComponent(proposalId)}`);
  };

  const handleReviewCollabRequest = async (collab, reviewAction) => {
    if (!collab?.id || collabReviewBusyId) return;
    setCollabReviewBusyId(`${reviewAction}:${collab.id}`);
    setCollabPanelNotice("");
    setCollabPanelError("");
    try {
      requireBackendAuthSession();
      const response = await fetch(`${API_BASE_URL}/proposal-collabs/${collab.id}/${reviewAction}`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to update collab request.");
      }
      const labels = {
        approve: "Collab request approved.",
        decline: "Collab request declined.",
        remove: "Collab request removed.",
      };
      setCollabPanelNotice(labels[reviewAction] || "Collab request updated.");
      setNotify([labels[reviewAction] || "Collab request updated."]);
      queryClient.invalidateQueries({ queryKey: ["proposal-collabs"] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    } catch (error) {
      setCollabPanelError(error?.message || BACKEND_AUTH_MISSING_MESSAGE);
    } finally {
      setCollabReviewBusyId("");
    }
  };

  const renderCollabRequestCard = (collab, direction) => {
    const isIncoming = direction === "incoming";
    const person = isIncoming ? collab.author : collab.collaborator;
    const busyKey = collabReviewBusyId || "";
    const proposalLabel = collab.proposal_title || `Proposal #${collab.proposal_id}`;

    return (
      <article key={`${direction}-${collab.id}`} className="profile-collab-request-card rounded-[1rem] p-3">
        <div className="flex items-start gap-3">
          <CollabUserAvatar user={person} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[0.82rem] font-black text-[var(--text-black)]">
                  {isIncoming ? "Incoming collab" : "Outgoing collab"}
                </p>
                <p className="truncate text-[0.72rem] text-[var(--text-gray-light)]">
                  {isIncoming
                    ? `${collabUserLabel(person)} invited you`
                    : `Waiting on ${collabUserLabel(person)}`}
                </p>
              </div>
              <span className="profile-collab-status-pill shrink-0 rounded-full px-2 py-1 text-[0.6rem] font-black uppercase tracking-[0.1em]">
                {collab.status || "pending"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openProposal(collab.proposal_id)}
              className="profile-collab-view-post mt-2 inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-left text-[0.72rem] font-black"
            >
              <span className="truncate">View post: {proposalLabel}</span>
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {isIncoming && (
            <>
              <button
                type="button"
                onClick={() => handleReviewCollabRequest(collab, "approve")}
                disabled={Boolean(collabReviewBusyId)}
                className="profile-collab-approve-button rounded-full px-3 py-1.5 text-[0.7rem] font-bold disabled:opacity-55"
                aria-busy={busyKey === `approve:${collab.id}`}
              >
                {busyKey === `approve:${collab.id}` ? "Approving..." : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => handleReviewCollabRequest(collab, "decline")}
                disabled={Boolean(collabReviewBusyId)}
                className="profile-collab-danger-button rounded-full px-3 py-1.5 text-[0.7rem] font-bold disabled:opacity-55"
                aria-busy={busyKey === `decline:${collab.id}`}
              >
                {busyKey === `decline:${collab.id}` ? "Declining..." : "Decline"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => handleReviewCollabRequest(collab, "remove")}
            disabled={Boolean(collabReviewBusyId)}
            className="profile-collab-secondary-button rounded-full px-3 py-1.5 text-[0.7rem] font-bold disabled:opacity-55"
            aria-busy={busyKey === `remove:${collab.id}`}
          >
            {busyKey === `remove:${collab.id}` ? "Removing..." : isIncoming ? "Remove" : "Cancel"}
          </button>
        </div>
      </article>
    );
  };

  const isProfileCollabPost = (post) => {
    const profileKey = username.toLowerCase();
    const authorKey = String(post?.userName || "").toLowerCase();
    if (!profileKey || !authorKey || authorKey === profileKey) return false;
    return Array.isArray(post?.collabs)
      && post.collabs.some(
        (collab) => collab?.status === "approved"
          && String(collab?.username || "").toLowerCase() === profileKey
      );
  };

  const renderPostCard = (post) => {
    const isCollabPost = isProfileCollabPost(post);
    return (
      <div key={post.id} className={isCollabPost ? "profile-collab-list-item grid gap-2" : ""}>
        {isCollabPost && (
          <div className="profile-collab-list-label mx-[0.35rem] inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.12em]">
            <IoPeopleOutline className="text-[0.9rem]" />
            Collab post
          </div>
        )}
        <ProposalCard
          id={post.id}
          userName={post.userName}
          userInitials={post.userInitials}
          time={formatRelativeTime(post.time)}
          title={post.title}
          text={post.text}
          logo={post.author_img}
          media={post.media}
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
      </div>
    );
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
      {errorMsg.length > 0 && <ErrorBanner messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}

      <section className="mobile-feed-panel social-panel rounded-[1rem] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={handleOpenProfileDomain}
            disabled={!profileTargetUrl}
            className={`shrink-0 rounded-full ${profileTargetUrl ? "cursor-pointer" : "cursor-default"}`}
            title={profileTargetUrl ? "Open profile domain" : undefined}
          >
            {avatarNode}
          </button>
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
            <button
              type="button"
              onClick={() => {
                setCollabPanelNotice("");
                setCollabPanelError("");
                setCollabPanelOpen((value) => !value);
              }}
              className={`profile-collab-entry-button relative flex h-10 w-10 items-center justify-center rounded-full ${
                collabPanelOpen
                  ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                  : "bg-white/[0.06] text-[var(--text-gray-light)] hover:text-[var(--pink)]"
              }`}
              aria-label="Review collab requests"
              title="Collab requests"
            >
              <IoPeopleOutline />
              {pendingCollabCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--pink)] px-1 text-[0.62rem] font-black text-white shadow-[var(--shadow-pink)]">
                  {pendingCollabCount > 9 ? "9+" : pendingCollabCount}
                </span>
              )}
            </button>
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
            {profile.bio ? (
              <LinkifiedText text={profile.bio} enableMentions validMentionUsernames={verifiedBioMentions} />
            ) : (
              <span className="text-[var(--text-gray-light)]">Add an about section.</span>
            )}
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
            <label
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[0.9rem] px-3 py-2 text-left text-[0.78rem] font-semibold ${
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
              <input
                type="checkbox"
                checked={domainAsProfileDraft}
                onChange={(event) => setDomainAsProfileDraft(event.target.checked)}
                className="sr-only"
              />
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
            </label>
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

        {collabPanelOpen && (
          <div className="profile-collab-panel mt-4 rounded-[1rem] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.9rem] font-black text-[var(--text-black)]">Collab requests</p>
                <p className="mt-1 text-[0.72rem] leading-5 text-[var(--text-gray-light)]">
                  {pendingCollabCount > 0
                    ? `${collabIncoming.length} incoming, ${collabOutgoing.length} outgoing pending.`
                    : "Review incoming invites and outgoing pending requests."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollabPanelOpen(false)}
                className="profile-collab-secondary-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                aria-label="Close collab requests"
              >
                <IoClose />
              </button>
            </div>

            {(collabPanelNotice || collabPanelError) && (
              <div className="profile-collab-state-slot mt-3">
                {collabPanelNotice && (
                  <div className="profile-collab-notice rounded-[0.9rem] px-3 py-2 text-[0.76rem] font-semibold">
                    {collabPanelNotice}
                  </div>
                )}
                {collabPanelError && (
                  <div className="profile-collab-error rounded-[0.9rem] px-3 py-2 text-[0.76rem] font-semibold">
                    {collabPanelError}
                  </div>
                )}
              </div>
            )}

            {!isAuthenticated || !currentUsername ? (
              <div className="profile-collab-empty mt-3 rounded-[0.9rem] px-3 py-4 text-[0.8rem] text-[var(--text-gray-light)]">
                Finish account setup or sign in again to review collab requests.
              </div>
            ) : collabRequestsQuery.isLoading ? (
              <div className="profile-collab-empty mt-3 rounded-[0.9rem] px-3 py-4 text-[0.8rem] text-[var(--text-gray-light)]">
                Loading collab requests...
              </div>
            ) : collabRequestsQuery.isError ? (
              <div className="profile-collab-error mt-3 rounded-[0.9rem] px-3 py-4 text-[0.8rem]">
                <p>{collabRequestsQuery.error?.message || "Unable to load collab requests."}</p>
                <button
                  type="button"
                  onClick={() => collabRequestsQuery.refetch()}
                  className="profile-collab-secondary-button mt-3 rounded-full px-3 py-1.5 text-[0.7rem] font-bold"
                >
                  Retry
                </button>
              </div>
            ) : pendingCollabCount === 0 ? (
              <div className="profile-collab-empty mt-3 rounded-[0.9rem] px-3 py-4 text-[0.8rem] text-[var(--text-gray-light)]">
                No pending collab requests.
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                <div className="profile-collab-section grid gap-2 rounded-[0.95rem] p-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[var(--text-gray-light)]">
                      Incoming
                    </p>
                    <span className="profile-collab-count-pill rounded-full px-2 py-0.5 text-[0.62rem] font-black">
                      {collabIncoming.length}
                    </span>
                  </div>
                  {collabIncoming.length > 0 ? (
                    collabIncoming.map((collab) => renderCollabRequestCard(collab, "incoming"))
                  ) : (
                    <div className="profile-collab-empty rounded-[0.85rem] px-3 py-3 text-[0.76rem] text-[var(--text-gray-light)]">
                      No incoming requests waiting on you.
                    </div>
                  )}
                </div>
                <div className="profile-collab-section grid gap-2 rounded-[0.95rem] p-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[var(--text-gray-light)]">
                      Outgoing
                    </p>
                    <span className="profile-collab-count-pill rounded-full px-2 py-0.5 text-[0.62rem] font-black">
                      {collabOutgoing.length}
                    </span>
                  </div>
                  {collabOutgoing.length > 0 ? (
                    collabOutgoing.map((collab) => renderCollabRequestCard(collab, "outgoing"))
                  ) : (
                    <div className="profile-collab-empty rounded-[0.85rem] px-3 py-3 text-[0.76rem] text-[var(--text-gray-light)]">
                      No outgoing invites waiting for approval.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
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
            <div className="mobile-feed-panel social-panel rounded-[1rem] px-3 py-3">
              <div className="grid grid-cols-3 gap-1.5 rounded-full bg-white/[0.045] p-1">
                {PROFILE_TABS.map((tab) => {
                  const selected = activeTab === tab.key;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      aria-label={tab.title}
                      title={tab.title}
                      aria-pressed={selected}
                      className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[0.72rem] font-bold transition-colors ${
                        selected
                          ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                          : "text-[var(--text-gray-light)] hover:bg-white/[0.055] hover:text-[var(--text-black)]"
                      }`}
                    >
                      <TabIcon className="shrink-0 text-[1rem]" aria-hidden="true" />
                      <span className="sr-only">{tab.label}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] ${
                        selected ? "bg-white/20 text-white" : "bg-white/[0.055] text-[var(--text-gray-light)]"
                      }`}>
                        {tabCounts[tab.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === "visuals" && (
              visualPosts.length === 0 ? (
                <div className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-8 text-center text-[0.86rem] text-[var(--text-gray-light)]">
                  <p>No visual posts yet.</p>
                  {posts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("proposals")}
                      className="mt-4 rounded-full bg-white/[0.065] px-4 py-2 text-[0.76rem] font-bold text-[var(--text-black)] hover:bg-white/[0.09]"
                    >
                      View proposals
                    </button>
                  )}
                </div>
              ) : (
                <div className="mobile-feed-panel social-panel rounded-[1rem] p-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {visualPosts.map(({ post, visual }, index) => (
                      <ProfileVisualTile
                        key={post.id || `${post.userName || "post"}-${index}`}
                        post={post}
                        visual={visual}
                        isCollab={isProfileCollabPost(post)}
                        onOpen={() => openProposal(post.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            )}

            {activeTab === "proposals" && posts.map(renderPostCard)}

            {activeTab === "text" && (
              textPosts.length === 0 ? (
                <div className="mobile-feed-panel social-panel rounded-[1rem] px-5 py-8 text-center text-[0.86rem] text-[var(--text-gray-light)]">
                  No text-only posts yet.
                </div>
              ) : (
                textPosts.map(renderPostCard)
              )
            )}

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

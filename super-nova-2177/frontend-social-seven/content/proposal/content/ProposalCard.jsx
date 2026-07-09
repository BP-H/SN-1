"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/content/profile/UserContext";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";
import {
  BACKEND_AUTH_MISSING_MESSAGE,
  authHeaders,
  formatBackendAuthErrorMessage,
  requireBackendAuthSession,
} from "@/utils/authSession";
import {
  IoCheckmark,
  IoClose,
  IoFlashOutline,
  IoHandLeftOutline,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
  IoTimeOutline,
} from "react-icons/io5";
import AiDelegateActionModal from "./AiDelegateActionModal";
import ProposalActionBar from "./ProposalActionBar";
import ProposalAuthorHeader from "./ProposalAuthorHeader";
import ProposalCollabPanel from "./ProposalCollabPanel";
import ProposalCommentsSection from "./ProposalCommentsSection";
import ProposalMediaBlock from "./ProposalMediaBlock";
import ProposalOptionsMenu from "./ProposalOptionsMenu";
import ProposalTextContent from "./ProposalTextContent";
import ProposalVoteSummary from "./ProposalVoteSummary";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";
import { BOOKMARKS_CHANGED_EVENT, isBookmarkedId, toggleBookmarkId } from "@/utils/bookmarks";
import { normalizeLinkHref } from "@/utils/linkify";
import { delegateDisplayLabel } from "@/utils/aiDelegateLabels";
import { useVerifiedMentionUsernames } from "@/utils/verifiedMentions";
import { buildWeightedVoteSummary } from "@/utils/voteWeights";

function formatDecisionCountdown(deadlineValue, fallbackDays, nowMs) {
  const safeFallbackDays = Number(fallbackDays || 0);
  if (!deadlineValue) return safeFallbackDays > 0 ? `${safeFallbackDays}d window` : "Window";
  const deadline = new Date(deadlineValue);
  if (Number.isNaN(deadline.getTime())) {
    return safeFallbackDays > 0 ? `${safeFallbackDays}d window` : "Window";
  }
  const remaining = deadline.getTime() - nowMs;
  if (remaining <= 0) return "Ended";
  const totalMinutes = Math.ceil(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function normalizeCollabSuggestions(payload = []) {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.users) ? payload.users : [];
  const seen = new Set();
  return list
    .map((item) => {
      const username = String(item?.username || "").trim();
      const key = username.toLowerCase();
      const avatar = item?.avatar || item?.avatar_url || item?.profile_pic || item?.profilePic || item?.author_img || "";
      return {
        username,
        key,
        species: String(item?.species || "human").trim() || "human",
        avatar: avatarDisplayUrl(avatar, ""),
        initials: String(item?.initials || username || "SN").slice(0, 2).toUpperCase(),
        canCollab: item?.can_collab ?? item?.canCollab ?? true,
      };
    })
    .filter((item) => {
      if (!item.username || item.canCollab === false || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
}

function supportSummaryLabel(likes = [], dislikes = [], voteSummary = null) {
  const likeList = Array.isArray(likes) ? likes : [];
  const dislikeList = Array.isArray(dislikes) ? dislikes : [];
  if (likeList.length + dislikeList.length > 0) {
    const weighted = buildWeightedVoteSummary(likeList, dislikeList);
    const percent = Math.max(0, Math.min(100, Math.round(weighted.supportPercent || 0)));
    return `${percent}% support`;
  }

  const summary = voteSummary || {};
  const summaryUp = Number(summary.up ?? summary.likes ?? summary.support);
  const summaryDown = Number(summary.down ?? summary.dislikes ?? summary.oppose);
  const up = Number.isFinite(summaryUp) ? summaryUp : 0;
  const down = Number.isFinite(summaryDown) ? summaryDown : 0;
  const summaryTotal = Number(summary.total);
  const total = Number.isFinite(summaryTotal) && summaryTotal > 0 ? summaryTotal : up + down;
  if (total <= 0) return "";
  const summaryRatio = Number(summary.approval_ratio);
  const ratio = Number.isFinite(summaryRatio) ? (summaryRatio > 1 ? summaryRatio / 100 : summaryRatio) : up / total;
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return `${percent}% support`;
}

function ProposalCard({
  id,
  userName,
  time,
  title,
  text,
  media = {},
  logo,
  likes = [],
  dislikes = [],
  likeCount = null,
  dislikeCount = null,
  commentCount = null,
  voteSummary = null,
  comments = [],
  collabs = [],
  profileUrl = "",
  domainAsProfile = false,
  specie = "human",
  setErrorMsg,
  setNotify,
  isDetailPage = false,
  showSupportSummary = false,
}) {
  // Dev-only render counter (NEXT_PUBLIC_DEBUG_RENDERS=true, or a window flag
  // tests can set) proving memoization keeps unrelated cards quiet.
  if (
    typeof window !== "undefined" &&
    (process.env.NEXT_PUBLIC_DEBUG_RENDERS === "true" || window.__SN_DEBUG_RENDERS === true)
  ) {
    window.__SN_CARD_RENDERS = window.__SN_CARD_RENDERS || {};
    const renderKey = String(id ?? "unknown");
    window.__SN_CARD_RENDERS[renderKey] = (window.__SN_CARD_RENDERS[renderKey] || 0) + 1;
  }

  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState(comments);
  const [fullCommentsLoaded, setFullCommentsLoaded] = useState(false);
  const [localText, setLocalText] = useState(text || "");
  const [editText, setEditText] = useState(text || "");
  const [readMore, setReadMore] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followingAuthor, setFollowingAuthor] = useState(false);
  const [localLogo, setLocalLogo] = useState(logo || "");
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  // Top-level reply threads collapse behind a "View N replies" toggle (YouTube
  // style). This holds the ids of the threads the viewer has expanded.
  const [expandedThreads, setExpandedThreads] = useState(() => new Set());
  const [aiCommentFocus, setAiCommentFocus] = useState("");
  const [aiCommentParentId, setAiCommentParentId] = useState(null);
  const [localUserName, setLocalUserName] = useState(userName || "");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [collabInviteOpen, setCollabInviteOpen] = useState(false);
  const [collabSearch, setCollabSearch] = useState("");
  const [collabSuggestions, setCollabSuggestions] = useState([]);
  const [collabBusy, setCollabBusy] = useState(false);
  const [collabStatus, setCollabStatus] = useState("");
  const [collabError, setCollabError] = useState("");
  const [aiActionModalMode, setAiActionModalMode] = useState("");
  const shareMenuRef = useRef(null);
  const optionsMenuRef = useRef(null);
  const pendingHashCommentRef = useRef("");

  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const authorName = localUserName || userName || "";
  const approvedCollabs = useMemo(() => {
    if (!Array.isArray(collabs)) return [];
    const seen = new Set();
    return collabs
      .filter((collab) => collab?.status === "approved" && collab?.username)
      .map((collab) => {
        const username = String(collab.username || "").trim();
        const key = username.toLowerCase();
        return {
          ...collab,
          username,
          key,
          avatar: avatarDisplayUrl(collab.avatar || collab.avatar_url || collab.profile_pic || "", ""),
          species: collab.species || "human",
        };
      })
      .filter((collab) => {
        if (!collab.username || seen.has(collab.key)) return false;
        seen.add(collab.key);
        return true;
      });
  }, [collabs]);
  const inlineApprovedCollabs = approvedCollabs.slice(0, 2);
  const extraApprovedCollabCount = Math.max(0, approvedCollabs.length - inlineApprovedCollabs.length);
  const avatarApprovedCollabs = approvedCollabs.slice(0, 3);
  const extraAvatarApprovedCollabCount = Math.max(0, approvedCollabs.length - avatarApprovedCollabs.length);
  const isOwner = Boolean(authorName && userData?.name && authorName.toLowerCase() === userData.name.toLowerCase());
  const verifiedMentions = useVerifiedMentionUsernames(localText);
  const authorSpecies = isOwner ? userData?.species || specie : specie || "human";
  const displayLogo = isOwner && normalizeAvatarValue(userData?.avatar) ? userData.avatar : localLogo;
  const displayAvatar = avatarDisplayUrl(displayLogo, defaultAvatar);
  const governance = media?.governance || null;
  const isDecisionProposal = governance?.kind === "decision";
  const decisionThreshold = Number(governance?.approval_threshold ?? governance?.threshold ?? 0);
  const decisionThresholdLabel = decisionThreshold > 0 ? `${Math.round(decisionThreshold * 100)}%` : "";
  const decisionExecutionMode = String(governance?.execution_mode || governance?.execution || "manual").toLowerCase();
  const isAutomaticExecution = decisionExecutionMode === "automatic" || decisionExecutionMode === "auto";
  const DecisionExecutionIcon = isAutomaticExecution ? IoFlashOutline : IoHandLeftOutline;
  const decisionExecutionLabel = isAutomaticExecution ? "Auto" : "Manual";
  const decisionExecutionTitle = isAutomaticExecution ? "Automatic execution" : "Manual execution";
  const decisionDeadlineLabel = isDecisionProposal
    ? formatDecisionCountdown(governance?.voting_deadline, governance?.voting_days, nowMs)
    : "";

  useEffect(() => {
    if (!isDecisionProposal || !governance?.voting_deadline) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, [governance?.voting_deadline, isDecisionProposal]);

  useEffect(() => {
    const openAiDelegateAction = (event) => {
      if (String(event?.detail?.proposalId || "") !== String(id || "")) return;
      const nextMode = event?.detail?.mode === "comment" ? "comment" : "review";
      if (nextMode === "comment") setShowComments(true);
      setAiActionModalMode(nextMode);
    };
    window.addEventListener("supernova:open-ai-delegate-action", openAiDelegateAction);
    return () => window.removeEventListener("supernova:open-ai-delegate-action", openAiDelegateAction);
  }, [id]);

  const openAccountModal = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
    }
  };

  const openAiActionModal = (mode, focus = "", parentCommentId = null) => {
    if (!isAuthenticated || !userData?.name) {
      openAccountModal();
      return;
    }
    if (mode === "comment") {
      setShowComments(true);
      setAiCommentFocus(focus || "");
      setAiCommentParentId(parentCommentId || null);
    } else {
      setAiCommentFocus("");
      setAiCommentParentId(null);
    }
    setAiActionModalMode(mode);
  };

  useEffect(() => {
    if (!collabInviteOpen || collabSearch.trim().length < 1) {
      setCollabSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/social-users?search=${encodeURIComponent(collabSearch.trim())}&limit=8`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          setCollabSuggestions([]);
          return;
        }
        const selfKey = String(userData?.name || "").toLowerCase();
        setCollabSuggestions(
          normalizeCollabSuggestions(await response.json().catch(() => [])).filter((user) => user.key !== selfKey)
        );
      } catch (error) {
        if (error?.name !== "AbortError") setCollabSuggestions([]);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [collabInviteOpen, collabSearch, userData?.name]);

  useEffect(() => {
    if (id === undefined || id === null || id === "") return;
    const syncBookmarkState = () => setBookmarked(isBookmarkedId(id));
    syncBookmarkState();
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, syncBookmarkState);
    window.addEventListener("storage", syncBookmarkState);
    return () => {
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, syncBookmarkState);
      window.removeEventListener("storage", syncBookmarkState);
    };
  }, [id]);

  const handleToggleBookmark = () => {
    if (id === undefined || id === null || id === "") return;
    const isSaved = toggleBookmarkId(id);
    setBookmarked(isSaved);
    setMenuOpen(false);
  };

  const commentsById = useMemo(() => {
    const map = new Map();
    localComments.forEach((comment) => {
      if (comment?.id != null) {
        map.set(String(comment.id), comment);
      }
    });
    return map;
  }, [localComments]);
  const threadedComments = useMemo(() => {
    const roots = [];
    const children = new Map();
    localComments.forEach((comment, index) => {
      const item = { comment, index };
      const parentId = comment?.parent_comment_id;
      const parentKey = parentId == null ? "" : String(parentId);
      if (parentKey && commentsById.has(parentKey)) {
        const list = children.get(parentKey) || [];
        list.push(item);
        children.set(parentKey, list);
      } else {
        roots.push(item);
      }
    });

    const countDescendants = (key) => {
      const kids = children.get(key) || [];
      return kids.reduce((sum, child) => {
        const childKey = child.comment?.id == null ? "" : String(child.comment.id);
        return sum + 1 + (childKey ? countDescendants(childKey) : 0);
      }, 0);
    };

    const ordered = [];
    // Carry lineage hints so the thread rail knows where to stop. Ancestor rail
    // depths keep an outer reply spine visible while a nested child is rendered.
    const visit = (item, depth = 0, isLastChild = true, ancestorRailDepths = []) => {
      const renderDepth = Math.min(depth, 2);
      const key = item.comment?.id == null ? "" : String(item.comment.id);
      const kids = children.get(key) || [];
      // Only top-level comments collapse, and a single toggle reveals the whole
      // reply subtree at once (YouTube reveals every reply on one click).
      const collapsible = depth === 0 && kids.length > 0;
      const isCollapsed = collapsible && Boolean(key) && !expandedThreads.has(key);
      ordered.push({
        ...item,
        depth: renderDepth,
        isLastChild,
        hasChildren: kids.length > 0,
        ancestorRailDepths,
        collapsed: isCollapsed,
        replyCount: collapsible ? countDescendants(key) : 0,
      });
      // Collapsed threads stop here, so lineage stays correct for what renders.
      if (isCollapsed) return;
      const childAncestorRailDepths =
        renderDepth > 0 && !isLastChild
          ? [...ancestorRailDepths, renderDepth]
          : ancestorRailDepths;
      kids.forEach((child, childIndex) =>
        visit(child, renderDepth + 1, childIndex === kids.length - 1, childAncestorRailDepths)
      );
    };
    roots.forEach((item, rootIndex) => visit(item, 0, rootIndex === roots.length - 1));
    return ordered;
  }, [commentsById, localComments, expandedThreads]);

  const handleToggleThread = (commentId) => {
    const key = commentId == null ? "" : String(commentId);
    if (!key) return;
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Walk up to the top-level comment so replying to a nested comment opens the
  // whole thread (otherwise the new reply would land inside a collapsed thread).
  const rootCommentIdOf = (commentId) => {
    let current = commentId == null ? null : commentsById.get(String(commentId));
    let safety = 0;
    while (current && current.parent_comment_id != null && safety < 64) {
      const parent = commentsById.get(String(current.parent_comment_id));
      if (!parent) break;
      current = parent;
      safety += 1;
    }
    return current?.id ?? null;
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const getHashCommentId = () => {
      const hash = window.location.hash || "";
      if (!hash.startsWith("#comment-")) return "";
      try {
        return decodeURIComponent(hash.slice("#comment-".length));
      } catch {
        return hash.slice("#comment-".length);
      }
    };

    const revealHashComment = () => {
      const targetId = getHashCommentId();
      if (!targetId || !commentsById.has(String(targetId))) return;
      pendingHashCommentRef.current = String(targetId);
      setShowComments(true);
      const rootId = rootCommentIdOf(targetId);
      if (rootId == null) return;
      setExpandedThreads((prev) => {
        const key = String(rootId);
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    };

    revealHashComment();
    window.addEventListener("hashchange", revealHashComment);
    return () => window.removeEventListener("hashchange", revealHashComment);
  }, [commentsById]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    const targetId = pendingHashCommentRef.current;
    if (!targetId) return undefined;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const target = document.getElementById(`comment-${targetId}`);
        if (!target) return;
        pendingHashCommentRef.current = "";
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [threadedComments]);

  const getFullImageUrl = (url) => {
    const value = normalizeAvatarValue(url);
    if (!value) return null;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    return absoluteApiUrl(value);
  };

  const getYouTubeId = (url) => {
    if (!url) return "";
    const regExp =
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return url.match(regExp)?.[1] || "";
  };

  const getEmbedUrl = (url) => {
    if (!url) return "";
    try {
      if (url.includes("youtube.com/embed/")) return url;
      const videoId = getYouTubeId(url);
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      return url;
    } catch {
      return url;
    }
  };

  useEffect(() => {
    if (!shareMenuOpen) return undefined;
    const closeShareMenu = (event) => {
      if (!shareMenuRef.current?.contains(event.target)) {
        setShareMenuOpen(false);
      }
    };
    const closeOnScroll = () => setShareMenuOpen(false);
    document.addEventListener("pointerdown", closeShareMenu);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("wheel", closeOnScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeShareMenu);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("wheel", closeOnScroll);
    };
  }, [shareMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOptionsMenu = (event) => {
      if (!optionsMenuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const closeOnScroll = () => setMenuOpen(false);
    document.addEventListener("pointerdown", closeOptionsMenu);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("wheel", closeOnScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeOptionsMenu);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("wheel", closeOnScroll);
    };
  }, [menuOpen]);

  const handleShareLink = async () => {
    const url = `${window.location.origin}/proposals/${id || ""}`;
    const shareText = title ? `Check out: ${title}` : "Check out this signal";
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url });
        setShareMenuOpen(false);
        return;
      } catch {
        // User cancelled or the native share sheet failed; copy as fallback.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
    setShareMenuOpen(false);
  };

  const handleMessageShare = () => {
    setShareMenuOpen(false);
    if (!userData?.name) {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
      return;
    }
    const url = `${window.location.origin}/proposals/${id || ""}`;
    const shareText = title ? `Check out: ${title}` : "Check out this signal";
    try {
      sessionStorage.setItem(
        "supernova_dm_share_draft",
        JSON.stringify({
          proposalId: id,
          title: shareText,
          url,
          text: `${shareText}\n${url}`,
        })
      );
    } catch {
      // If storage is unavailable, the messages page still opens normally.
    }
    setNotify?.(["Choose someone in messages to share this post."]);
    router.push("/messages");
  };

  const refreshFeeds = () => {
    queryClient.invalidateQueries({ queryKey: ["home-feed"] });
    queryClient.invalidateQueries({ queryKey: ["home-following"] });
    queryClient.invalidateQueries({ queryKey: ["proposals"] });
    queryClient.invalidateQueries({ queryKey: ["user-posts"] });
    queryClient.invalidateQueries({ queryKey: ["desktop-social-graph"] });
    queryClient.invalidateQueries({ queryKey: ["universe-social-graph"] });
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) {
      setErrorMsg?.(["Post text cannot be empty."]);
      return;
    }
    setOwnerBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: editText.trim().replace(/\s+/g, " ").slice(0, 70),
          body: editText.trim(),
          author: userData.name,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Unable to edit post."));
      setLocalText(payload.text || editText.trim());
      setEditing(false);
      setMenuOpen(false);
      setNotify?.(["Post updated."]);
      refreshFeeds();
    } catch (error) {
      setErrorMsg?.([formatBackendAuthErrorMessage(error, "Unable to edit post.")]);
    } finally {
      setOwnerBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner || !window.confirm("Delete this post?")) return;
    setOwnerBusy(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/proposals/${encodeURIComponent(id)}?author=${encodeURIComponent(userData.name)}`,
        { method: "DELETE", headers: authHeaders() }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Unable to delete post."));
      setDeleted(true);
      setNotify?.(["Post deleted."]);
      refreshFeeds();
    } catch (error) {
      setErrorMsg?.([formatBackendAuthErrorMessage(error, "Unable to delete post.")]);
    } finally {
      setOwnerBusy(false);
    }
  };

  const handleRequestCollab = async (username) => {
    const collaboratorUsername = String(username || collabSearch || "").trim();
    if (!collaboratorUsername || collabBusy) return;
    if (!userData?.name) {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
      return;
    }
    if (collaboratorUsername.toLowerCase() === userData.name.toLowerCase()) {
      setCollabError("Choose someone other than yourself.");
      return;
    }

    setCollabBusy(true);
    setCollabError("");
    setCollabStatus("");
    try {
      requireBackendAuthSession();
      const response = await fetch(`${API_BASE_URL}/proposal-collabs/request`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          proposal_id: Number(id),
          collaborator_username: collaboratorUsername,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Unable to invite collaborator."));
      }
      setCollabStatus(`Invite sent to @${payload?.collab?.collaborator?.username || collaboratorUsername}.`);
      setNotify?.([`Collab invite sent to ${payload?.collab?.collaborator?.username || collaboratorUsername}.`]);
      setCollabSearch("");
      setCollabSuggestions([]);
      queryClient.invalidateQueries({ queryKey: ["proposal-collabs"] });
    } catch (error) {
      const message = formatBackendAuthErrorMessage(error, BACKEND_AUTH_MISSING_MESSAGE);
      setCollabError(message);
      setErrorMsg?.([message]);
    } finally {
      setCollabBusy(false);
    }
  };

  const handleMessageAuthor = () => {
    if (!userData?.name) {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
      return;
    }
    if (!authorName || isOwner) return;
    setMenuOpen(false);
    router.push(`/messages?to=${encodeURIComponent(authorName)}`);
  };

  const handleToggleFollow = async () => {
    if (!userData?.name) {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
      return;
    }
    if (!authorName || isOwner || followBusy) return;
    setFollowBusy(true);
    try {
      const response = await fetch(
        followingAuthor
          ? `${API_BASE_URL}/follows?follower=${encodeURIComponent(userData.name)}&target=${encodeURIComponent(authorName)}`
          : `${API_BASE_URL}/follows`,
        {
          method: followingAuthor ? "DELETE" : "POST",
          headers: followingAuthor ? authHeaders() : authHeaders({ "Content-Type": "application/json" }),
          body: followingAuthor
            ? undefined
            : JSON.stringify({ follower: userData.name, target: authorName }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Follow action failed."));
      setFollowingAuthor(Boolean(payload.following));
      setNotify?.([payload.following ? `Following ${authorName}.` : `Unfollowed ${authorName}.`]);
      queryClient.invalidateQueries({ queryKey: ["home-following"] });
      queryClient.invalidateQueries({ queryKey: ["desktop-social-graph"] });
      queryClient.invalidateQueries({ queryKey: ["universe-social-graph"] });
    } catch (error) {
      setErrorMsg?.([formatBackendAuthErrorMessage(error, "Follow action failed.")]);
    } finally {
      setFollowBusy(false);
      setMenuOpen(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!commentId || !userData?.name || deletingCommentId) return;
    setDeletingCommentId(commentId);
    try {
      const response = await fetch(
        `${API_BASE_URL}/comments/${encodeURIComponent(commentId)}?user=${encodeURIComponent(userData.name)}`,
        { method: "DELETE", headers: authHeaders() }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Unable to delete comment."));
      setLocalComments((prevComments) => {
        const prunedIds = new Set((payload?.pruned_comment_ids || []).map((item) => String(item)));
        if (payload?.tombstone && payload?.comment) {
          return prevComments
            .filter((comment) => !prunedIds.has(String(comment.id || "")))
            .map((comment) =>
              String(comment.id || "") === String(commentId)
                ? { ...comment, ...payload.comment }
                : comment
            );
        }
        return prevComments.filter(
          (comment) => String(comment.id || "") !== String(commentId) && !prunedIds.has(String(comment.id || ""))
        );
      });
      if (String(replyTarget?.id || "") === String(commentId)) {
        setReplyTarget(null);
      }
      setNotify?.([payload?.tombstone ? "Comment removed, replies preserved." : "Comment deleted."]);
      refreshFeeds();
    } catch (error) {
      setErrorMsg?.([formatBackendAuthErrorMessage(error, "Unable to delete comment.")]);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleEditComment = async (commentId, nextText) => {
    if (!commentId || !userData?.name) throw new Error("Sign in to edit this comment.");
    const response = await fetch(`${API_BASE_URL}/comments/${encodeURIComponent(commentId)}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        user: userData.name,
        comment: nextText,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Unable to edit comment."));
    const updatedComment = payload?.comment ? payload : payload?.comments?.[0] || null;
    setLocalComments((prevComments) =>
      prevComments.map((comment) =>
        String(comment.id || "") === String(commentId)
          ? { ...comment, ...(updatedComment || {}), comment: updatedComment?.comment || nextText }
          : comment
      )
    );
    refreshFeeds();
  };

  const displayVideo = media.video || (getYouTubeId(media.link) ? media.link : null);
  const displayLink = displayVideo === media.link ? null : media.link;
  const displayImages =
    Array.isArray(media.images) && media.images.length > 0
      ? media.images
      : media.image
      ? [media.image]
      : [];
  const displayImageDimensions =
    Array.isArray(media.image_dimensions) && media.image_dimensions.length === displayImages.length
      ? media.image_dimensions
      : null;
  const displayFile = media.file ? getFullImageUrl(media.file) : "";
  const isPdfFile = /\.pdf(?:$|\?)/i.test(displayFile || "");
  const mediaLayout = media.layout === "grid" ? "grid" : "carousel";
  const userHref = authorName ? `/users/${encodeURIComponent(authorName)}` : "/profile";
  const profileDomainHref = domainAsProfile && profileUrl ? normalizeLinkHref(profileUrl) : "";
  const userVote = likes.some((v) => v.voter === userData?.name)
    ? "like"
    : dislikes.some((v) => v.voter === userData?.name)
    ? "dislike"
    : "";
  const supportSummary = showSupportSummary ? supportSummaryLabel(likes, dislikes, voteSummary) : "";
  const authorLabel = authorName || "Unknown";

  const youtubeId = getYouTubeId(displayVideo);
  const videoThumbnail = youtubeId
    ? `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`
    : "";
  const videoThumbnailFallback = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : "";
  const displayVideoUrl = displayVideo ? getFullImageUrl(displayVideo) : "";
  const videoEmbedUrl = displayVideo ? getEmbedUrl(displayVideo) : "";

  useEffect(() => {
    const handlePostAction = (event) => {
      const detail = event.detail || {};
      if (String(detail.id) !== String(id)) return;
      if (detail.action === "comment" || detail.action === "engage") {
        setShowComments(true);
      }
      if (detail.action === "comment-posted" && detail.comment) {
        setShowComments(true);
        setLocalComments((prevComments) => [...prevComments, detail.comment]);
      }
    };
    window.addEventListener("supernova:post-action", handlePostAction);
    return () => window.removeEventListener("supernova:post-action", handlePostAction);
  }, [id]);

  useEffect(() => {
    setLocalText(text || "");
    setEditText(text || "");
  }, [id, text]);

  useEffect(() => {
    setLocalComments(Array.isArray(comments) ? comments : []);
    setFullCommentsLoaded(false);
  }, [comments, id]);

  // Feeds embed only a capped comment preview (M3.1); the full thread loads
  // on demand the first time the viewer opens the comments section.
  const embeddedCommentCount = Array.isArray(comments) ? comments.length : 0;
  const serverCommentCount = Number.isFinite(Number(commentCount)) ? Number(commentCount) : null;
  const needsFullComments =
    !isDetailPage && serverCommentCount !== null && serverCommentCount > embeddedCommentCount;

  useEffect(() => {
    if (!showComments || fullCommentsLoaded || !needsFullComments) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/proposals/${encodeURIComponent(id)}`);
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        if (cancelled || !payload) return;
        if (Array.isArray(payload.comments)) setLocalComments(payload.comments);
        setFullCommentsLoaded(true);
      } catch {
        // Keep the embedded preview if the full read fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showComments, fullCommentsLoaded, needsFullComments, id]);

  useEffect(() => {
    setLocalLogo(logo || "");
  }, [id, logo]);

  useEffect(() => {
    if (!menuOpen || isOwner || !userData?.name || !authorName) return undefined;
    let cancelled = false;
    fetch(
      `${API_BASE_URL}/follows/status?follower=${encodeURIComponent(userData.name)}&target=${encodeURIComponent(authorName)}`,
      { headers: authHeaders() }
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload) setFollowingAuthor(Boolean(payload.following));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authorName, isOwner, menuOpen, userData?.name]);

  useEffect(() => {
    setLocalUserName(userName || "");
  }, [id, userName]);

  useEffect(() => {
    const handleAvatarUpdate = (event) => {
      const detail = event.detail || {};
      if (!detail.username || !authorName) return;
      const aliases = [detail.username, detail.previousUsername, detail.oldUsername]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      if (!aliases.includes(String(authorName).toLowerCase())) return;
      setLocalUserName(detail.username || authorName);
      setLocalLogo(detail.avatar || "");
      setLocalComments((prevComments) =>
        prevComments.map((comment) => {
          const commentUser = String(comment.user || "");
          if (commentUser === "[deleted]" || !aliases.includes(commentUser.toLowerCase())) return comment;
          return {
            ...comment,
            user: detail.username || comment.user,
            user_img: detail.avatar || comment.user_img || "",
            species: detail.species || comment.species,
          };
        })
      );
    };
    window.addEventListener("supernova:profile-avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("supernova:profile-avatar-updated", handleAvatarUpdate);
  }, [authorName]);

  if (deleted) return null;

  return (
    <div
      data-proposal-card
      data-proposal-id={id}
      data-proposal-title={(title || localText || "").slice(0, 180)}
      data-proposal-author={authorName || ""}
      data-proposal-text={(localText || title || "").slice(0, 360)}
      data-proposal-user-vote={userVote}
      className={`mobile-post-card bgWhiteTrue social-panel-compact relative mx-auto flex w-full flex-col gap-4 rounded-[1.75rem] p-5 text-[var(--text-black)] shadow-sm ${
        isDetailPage ? "" : "hover:shadow-md"
      }`}
    >
      {/* Header: avatar, name, time, options */}
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <ProposalAuthorHeader
          authorLabel={authorLabel}
          authorSpecies={authorSpecies}
          avatarApprovedCollabs={avatarApprovedCollabs}
          defaultAvatar={defaultAvatar}
          displayAvatar={displayAvatar}
          extraApprovedCollabCount={extraApprovedCollabCount}
          extraAvatarApprovedCollabCount={extraAvatarApprovedCollabCount}
          inlineApprovedCollabs={inlineApprovedCollabs}
          profileDomainHref={profileDomainHref}
          time={time}
          userHref={userHref}
        />

        <ProposalOptionsMenu
          authorName={authorName}
          bookmarked={bookmarked}
          followBusy={followBusy}
          followingAuthor={followingAuthor}
          isOwner={isOwner}
          menuOpen={menuOpen}
          onDelete={handleDelete}
          onEdit={() => {
            setEditText(localText || "");
            setEditing(true);
            setMenuOpen(false);
          }}
          onInviteCollab={() => {
            setCollabInviteOpen((value) => !value);
            setCollabStatus("");
            setCollabError("");
            setMenuOpen(false);
          }}
          onMessageAuthor={handleMessageAuthor}
          onProfileClick={() => setMenuOpen(false)}
          onToggleBookmark={handleToggleBookmark}
          onToggleFollow={handleToggleFollow}
          onToggleMenu={() => setMenuOpen((value) => !value)}
          optionsMenuRef={optionsMenuRef}
          ownerBusy={ownerBusy}
          profileDomainHref={profileDomainHref}
          userHref={userHref}
        />
      </div>

      <ProposalVoteSummary supportSummary={supportSummary} />

      {isOwner && collabInviteOpen && (
        <ProposalCollabPanel
          collabBusy={collabBusy}
          collabError={collabError}
          collabSearch={collabSearch}
          collabStatus={collabStatus}
          collabSuggestions={collabSuggestions}
          onClose={() => setCollabInviteOpen(false)}
          onRequestCollab={handleRequestCollab}
          onSearchChange={(value) => {
            setCollabSearch(value);
            setCollabStatus("");
            setCollabError("");
          }}
        />
      )}

      {/* Post content (text + media) */}
      <div className="flex w-full min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-3">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                className="composer-textarea min-h-28 resize-y rounded-[1rem] border border-[var(--horizontal-line)] bg-white/[0.055] px-3 py-3 text-[0.92rem] outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditText(localText || "");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-[var(--text-gray-light)]"
                  aria-label="Cancel edit"
                >
                  <IoClose />
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={ownerBusy}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)] disabled:opacity-50"
                  aria-label="Save edit"
                >
                  <IoCheckmark />
                </button>
              </div>
            </div>
          ) : (
            <ProposalTextContent
              text={localText}
              readMore={readMore}
              onToggleReadMore={() => setReadMore((value) => !value)}
              verifiedMentions={verifiedMentions}
            />
          )}

          {isDecisionProposal && (
            <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-gray-light)]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--horizontal-line)] bg-white/[0.045] px-2.5 py-1 text-[var(--pink)]">
                <IoShieldCheckmarkOutline className="text-[0.82rem]" />
                Decision{decisionThresholdLabel ? ` ${decisionThresholdLabel}` : ""}
              </span>
              {decisionDeadlineLabel && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--horizontal-line)] bg-white/[0.035] px-2.5 py-1"
                  title="Voting countdown"
                >
                  <IoTimeOutline className="text-[0.78rem] text-[var(--pink)]" />
                  {decisionDeadlineLabel}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--horizontal-line)] bg-white/[0.035] px-2.5 py-1"
                title={decisionExecutionTitle}
              >
                <DecisionExecutionIcon className="text-[0.78rem] text-[var(--pink)]" />
                {decisionExecutionLabel}
              </span>
            </div>
          )}

          <ProposalMediaBlock
            displayFile={displayFile}
            displayImages={displayImages}
            displayImageDimensions={displayImageDimensions}
            displayLink={displayLink}
            displayVideo={displayVideo}
            displayVideoUrl={displayVideoUrl}
            getImageUrl={getFullImageUrl}
            isPdfFile={isPdfFile}
            mediaLayout={mediaLayout}
            onOpenVideo={() => setVideoOpen(true)}
            onVideoLoaded={() => setVideoLoaded(true)}
            title={title}
            videoEmbedUrl={videoEmbedUrl}
            videoLoaded={videoLoaded}
            videoOpen={videoOpen}
            videoThumbnail={videoThumbnail}
            videoThumbnailFallback={videoThumbnailFallback}
            youtubeId={youtubeId}
          />
        </div>

        <ProposalActionBar
          aiReviewButton={(
            <button
              type="button"
              onClick={() => openAiActionModal("review")}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                aiActionModalMode === "review"
                  ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                  : "text-[var(--text-gray-light)] hover:bg-[rgba(255,255,255,0.07)]"
              }`}
              title="Generate AI review"
              aria-label="Generate AI review"
              aria-expanded={aiActionModalMode === "review"}
            >
              <IoSparklesOutline className="text-[0.9rem]" />
            </button>
          )}
          commentCount={
            serverCommentCount !== null && !fullCommentsLoaded
              ? Math.max(0, serverCommentCount + (localComments.length - embeddedCommentCount))
              : localComments.length
          }
          copied={copied}
          dislikes={dislikes}
          likes={likes}
          likeCount={likeCount}
          dislikeCount={dislikeCount}
          onMessageShare={handleMessageShare}
          onShareLink={handleShareLink}
          onToggleComments={() => setShowComments((value) => !value)}
          onToggleShareMenu={() => setShareMenuOpen((value) => !value)}
          proposalId={id}
          setErrorMsg={setErrorMsg}
          shareMenuOpen={shareMenuOpen}
          shareMenuRef={shareMenuRef}
          showComments={showComments}
          userVote={userVote}
        />

        <ProposalCommentsSection
          aiActionModalMode={aiActionModalMode}
          commentsById={commentsById}
          currentUsername={userData?.name}
          deletingCommentId={deletingCommentId}
          isDetailPage={isDetailPage}
          localComments={localComments}
          onAskAi={(target) => {
            const excerpt = String(target?.comment || "").replace(/\s+/g, " ").slice(0, 160);
            openAiActionModal("comment", `Respond to @${target?.user || "this comment"}: ${excerpt}`, target?.id || null);
          }}
          onCancelReply={() => setReplyTarget(null)}
          onDeleteComment={handleDeleteComment}
          onEditComment={handleEditComment}
          onGenerateAiComment={() => openAiActionModal("comment")}
          onReply={(target) => {
            setReplyTarget(target);
            setShowComments(true);
            const rootId = rootCommentIdOf(target?.id);
            if (rootId != null) {
              setExpandedThreads((prev) => new Set(prev).add(String(rootId)));
            }
          }}
          onToggleThread={handleToggleThread}
          proposalId={id}
          replyTarget={replyTarget}
          setErrorMsg={setErrorMsg}
          setLocalComments={setLocalComments}
          setNotify={setNotify}
          showComments={showComments}
          threadedComments={threadedComments}
        />
      </div>
      <AiDelegateActionModal
        open={Boolean(aiActionModalMode)}
        mode={aiActionModalMode}
        target={{
          id,
          title,
          text: localText,
          author: authorName,
          species: specie,
          media,
          parent_comment_id: aiActionModalMode === "comment" ? aiCommentParentId : null,
        }}
        initialFocus={aiActionModalMode === "comment" ? aiCommentFocus : ""}
        onClose={() => {
          setAiActionModalMode("");
          setAiCommentParentId(null);
        }}
        onApproved={(payload, draftAction) => {
          const publishedComment = payload?.summary?.comment;
          if (publishedComment && typeof publishedComment === "object" && (aiActionModalMode === "comment" || aiActionModalMode === "review")) {
            setLocalComments((items) => [...items, publishedComment]);
            setShowComments(true);
          }
          if (aiActionModalMode === "review" && payload?.summary?.vote) {
            window.dispatchEvent(new CustomEvent("supernova:post-action", {
              detail: {
                id,
                action: "vote-recorded",
                vote: payload.summary.vote,
                voter: payload.summary.actor,
                voter_type: payload.summary.actor_species || "ai",
              },
            }));
          }
          const draftPayload = draftAction?.draft_payload || {};
          const actorName = delegateDisplayLabel({
            display_name: draftPayload.ai_actor_display_name || draftPayload.display_name,
            username: draftPayload.ai_actor_username,
          }) || "AI delegate";
          setNotify?.([`Published as ${actorName}.`]);
          refreshFeeds();
        }}
        onCanceled={() => {
          setNotify?.(["Canceled - nothing published."]);
        }}
      />
    </div>
  );
}

// Feed pages keep per-card props referentially stable, so a shallow memo stops
// unrelated feed state (composer, modals, follows) from re-rendering every card.
export default memo(ProposalCard);

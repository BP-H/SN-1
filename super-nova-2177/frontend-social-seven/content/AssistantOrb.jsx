"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeAvatarValue } from "@/utils/avatar";
import { FaCommentAlt, FaShare } from "react-icons/fa";
import {
  IoChatbubbleEllipsesOutline,
  IoKeyOutline,
  IoListCircleOutline,
  IoPlanetOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { RiVoiceAiFill } from "react-icons/ri";
import { BiSolidDislike, BiSolidLike } from "react-icons/bi";
import { API_BASE_URL } from "@/utils/apiBase";
import {
  BACKEND_AUTH_MISSING_MESSAGE,
  authHeaders,
  formatBackendAuthErrorMessage,
  requireBackendAuthSession,
} from "@/utils/authSession";
import { MentionAutocomplete, useMentionAutocomplete } from "@/utils/mentionAutocomplete";
import { useUser } from "@/content/profile/UserContext";
import AssistantAiActionsList from "./assistant/AssistantAiActionsList";
import AssistantCollabRequestsPanel from "./assistant/AssistantCollabRequestsPanel";
import AssistantCommentPanel from "./assistant/AssistantCommentPanel";
import AssistantOrbShell from "./assistant/AssistantOrbShell";
import AssistantSettingsPanel from "./assistant/AssistantSettingsPanel";
import AssistantStatusBox from "./assistant/AssistantStatusBox";

const ORB_SIZE = 56;
const DIAL_SIZE = 184;

const AiWidgetIcon = ({ className = "" }) => <RiVoiceAiFill className={className} />;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isKeyboardEditable(element) {
  if (!element?.closest?.("[data-ai-cursor-root]")) return false;
  const tag = element.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || Boolean(element.isContentEditable);
}

function fallbackFor(action, target) {
  const title = target?.title || "this post";
  const author = target?.author || "the author";
  const text = target?.text || title;

  if (action === "brief") {
    return `${title} by ${author}. Core signal: ${text.slice(0, 150)}${text.length > 150 ? "..." : ""}`;
  }

  return "Post selected. Comments are open so you can engage directly.";
}

function buildPrompt(action, target) {
  const text = target?.text || "";
  return `Summarize this SuperNova social post in two short bullets and name one useful next action.\n\nAuthor: ${target?.author}\nTitle: ${target?.title}\nText: ${text}`;
}

function aiConfigMessage(payload = {}) {
  const code = payload?.error_code || "";
  if (code === "server_key_missing") return "Server AI key missing. Set OPENAI_API_KEY in Vercel.";
  if (code === "openai_request_failed") return "OpenAI request failed.";
  return "AI unavailable; fallback text will be used.";
}

function hasUsableAiReply(response, payload = {}) {
  return Boolean(response?.ok && payload?.ai_configured === true && payload?.reply);
}

function connectorActionActorLabel(action = {}) {
  const payload = action.draft_payload || {};
  return (
    payload.ai_actor_display_name ||
    payload.display_name ||
    payload.actor ||
    payload.ai_actor_username ||
    "AI delegate"
  );
}

export default function AssistantOrb() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userData, isAuthenticated } = useUser();
  const dockRef = useRef(null);
  const orbRef = useRef(null);
  const commentInputRef = useRef(null);
  const hoverElementRef = useRef(null);
  const returnTimerRef = useRef(null);
  const keyboardFocusRef = useRef(false);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    offsetX: ORB_SIZE / 2,
    offsetY: ORB_SIZE / 2,
    source: "dock",
  });
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ghostVisible, setGhostVisible] = useState(false);
  const [returning, setReturning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiSettingsNotice, setAiSettingsNotice] = useState("");
  const [aiTesting, setAiTesting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [connectorActions, setConnectorActions] = useState([]);
  const [connectorActionsLoading, setConnectorActionsLoading] = useState(false);
  const [connectorActionsError, setConnectorActionsError] = useState("");
  const [connectorActionsNotice, setConnectorActionsNotice] = useState("");
  const [connectorActionBusyId, setConnectorActionBusyId] = useState(null);
  const [collabIncoming, setCollabIncoming] = useState([]);
  const [collabOutgoing, setCollabOutgoing] = useState([]);
  const [collabRequestsLoading, setCollabRequestsLoading] = useState(false);
  const [collabRequestsError, setCollabRequestsError] = useState("");
  const [lastSignal, setLastSignal] = useState(null);
  const mentionAutocomplete = useMentionAutocomplete({
    value: commentText,
    setValue: setCommentText,
    inputRef: commentInputRef,
  });
  const trackCommentMentionCaret = mentionAutocomplete.trackCaret;

  const getDockPosition = useCallback(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        x: Math.max(8, window.innerWidth - ORB_SIZE - 10),
        y: Math.max(8, 12 + (40 - ORB_SIZE) / 2),
      };
    }
    return {
      x: clamp(rect.left + rect.width / 2 - ORB_SIZE / 2, 8, window.innerWidth - ORB_SIZE - 8),
      y: clamp(rect.top + rect.height / 2 - ORB_SIZE / 2, 8, window.innerHeight - ORB_SIZE - 8),
    };
  }, []);

  const getPostElementAtPoint = useCallback((x, y) => {
    const orb = orbRef.current;
    if (orb) orb.style.pointerEvents = "none";
    const element = document.elementFromPoint(x, y);
    if (orb) orb.style.pointerEvents = "";
    return element?.closest?.("[data-proposal-card]") || null;
  }, []);

  const getPostData = useCallback((post) => {
    if (!post) return null;
    return {
      id: post.dataset.proposalId,
      title: post.dataset.proposalTitle || "Selected post",
      author: post.dataset.proposalAuthor || "Unknown",
      text: post.dataset.proposalText || post.dataset.proposalTitle || "",
      userVote: post.dataset.proposalUserVote || "",
    };
  }, []);

  const clearHover = useCallback(() => {
    hoverElementRef.current?.classList.remove("ai-cursor-target");
    hoverElementRef.current = null;
    setHoverTarget(null);
  }, []);

  const returnToDock = useCallback(() => {
    if (typeof window === "undefined") return;
    window.clearTimeout(returnTimerRef.current);
    clearHover();
    setMenuOpen(false);
    setSettingsOpen(false);
    setCommentOpen(false);
    setActionsOpen(false);
    setReply("");
    setDragging(false);
    setReturning(true);
    setPos(getDockPosition());
    returnTimerRef.current = window.setTimeout(() => {
      setGhostVisible(false);
      setReturning(false);
      dockRef.current?.classList.remove("ai-cursor-dock-hidden");
    }, 460);
  }, [clearHover, getDockPosition]);

  useEffect(() => {
    setMounted(true);
    const frame = window.requestAnimationFrame(() => setPos(getDockPosition()));
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(returnTimerRef.current);
    };
  }, [getDockPosition]);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleResize = () => {
      if (!dragRef.current.active && !ghostVisible && !menuOpen && !settingsOpen && !commentOpen && !actionsOpen && !reply) {
        setPos(getDockPosition());
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [actionsOpen, commentOpen, getDockPosition, ghostVisible, menuOpen, mounted, reply, settingsOpen]);

  useEffect(() => {
    if (!mounted) return undefined;

    const syncKeyboardFocus = () => {
      keyboardFocusRef.current = isKeyboardEditable(document.activeElement);
    };
    const syncAfterFocusLeaves = () => {
      window.setTimeout(syncKeyboardFocus, 0);
    };

    document.addEventListener("focusin", syncKeyboardFocus);
    document.addEventListener("focusout", syncAfterFocusLeaves);
    syncKeyboardFocus();
    return () => {
      document.removeEventListener("focusin", syncKeyboardFocus);
      document.removeEventListener("focusout", syncAfterFocusLeaves);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleMove = (event) => {
      if (!dragRef.current.active) return;
      const nextX = clamp(event.clientX - dragRef.current.offsetX, 8, window.innerWidth - ORB_SIZE - 8);
      const nextY = clamp(event.clientY - dragRef.current.offsetY, 70, window.innerHeight - ORB_SIZE - 8);
      const moved =
        Math.abs(event.clientX - dragRef.current.startX) > 5 ||
        Math.abs(event.clientY - dragRef.current.startY) > 5;
      dragRef.current = {
        ...dragRef.current,
        moved: dragRef.current.moved || moved,
        x: event.clientX,
        y: event.clientY,
      };
      setPos({ x: nextX, y: nextY });

      const hoveredPost = getPostElementAtPoint(event.clientX, event.clientY);
      if (hoveredPost !== hoverElementRef.current) {
        hoverElementRef.current?.classList.remove("ai-cursor-target");
        hoveredPost?.classList.add("ai-cursor-target");
        hoverElementRef.current = hoveredPost;
        setHoverTarget(hoveredPost ? getPostData(hoveredPost) : null);
      }
    };

    const handleUp = () => {
      if (!dragRef.current.active) return;
      const wasMoved = dragRef.current.moved;
      const point = { x: dragRef.current.x, y: dragRef.current.y };
      const source = dragRef.current.source;
      dragRef.current.active = false;
      setDragging(false);
      clearHover();

      if (wasMoved) {
        const nextTarget = getPostData(getPostElementAtPoint(point.x, point.y));
        if (nextTarget) {
          setTarget(nextTarget);
          setReply("");
          setSettingsOpen(false);
          setCommentOpen(false);
          setMenuOpen(true);
          setGhostVisible(true);
          return;
        }
        returnToDock();
        return;
      }

      if (source === "orb") {
        setGhostVisible(true);
        setSettingsOpen(false);
        setCommentOpen(false);
        setReply("");
        setMenuOpen((value) => (target ? !value : true));
        if (!target) setReply("Drag the AI cursor onto a post first.");
        return;
      }

      setGhostVisible(true);
      setMenuOpen(false);
      setCommentOpen(false);
      setReply("");
      setSettingsOpen((value) => !value);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [clearHover, getPostData, getPostElementAtPoint, mounted, returnToDock, target]);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleOutside = (event) => {
      const hasActiveUi = ghostVisible || menuOpen || settingsOpen || commentOpen || actionsOpen || Boolean(reply);
      if (!hasActiveUi || dragRef.current.active) return;
      if (event.target?.closest?.("[data-ai-cursor-root]")) return;
      returnToDock();
    };

    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [actionsOpen, commentOpen, ghostVisible, menuOpen, mounted, reply, returnToDock, settingsOpen]);

  useEffect(() => {
    if (!commentOpen) return undefined;
    const timer = window.setTimeout(() => {
      const textarea = commentInputRef.current;
      if (!textarea) return;
      textarea.focus();
      const caret = textarea.value.length;
      textarea.setSelectionRange(caret, caret);
      trackCommentMentionCaret(textarea);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [commentOpen, trackCommentMentionCaret]);

  useEffect(() => {
    setLastSignal(target?.userVote || null);
  }, [target?.id, target?.userVote]);

  useEffect(() => {
    if (!mounted) return undefined;

    const retreat = (event) => {
      if (dragRef.current.active) return;
      if (event?.target?.closest?.("[data-ai-cursor-root]")) return;
      if (event?.type !== "wheel" && keyboardFocusRef.current && isKeyboardEditable(document.activeElement)) return;
      if (menuOpen || settingsOpen || commentOpen || actionsOpen || reply) returnToDock();
    };
    const escape = (event) => {
      if (event.key === "Escape") returnToDock();
    };

    window.addEventListener("scroll", retreat, { passive: true });
    window.addEventListener("wheel", retreat, { passive: true });
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", retreat);
      window.removeEventListener("wheel", retreat);
      window.removeEventListener("keydown", escape);
    };
  }, [actionsOpen, commentOpen, menuOpen, mounted, reply, returnToDock, settingsOpen]);

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(returnTimerRef.current);

    const fromDock = event.currentTarget === dockRef.current;
    const startPos = fromDock ? getDockPosition() : pos;
    if (fromDock) dockRef.current?.classList.add("ai-cursor-dock-hidden");
    setPos(startPos);
    setGhostVisible(true);
    setReturning(false);
    setDragging(true);
    setMenuOpen(false);
    setSettingsOpen(false);
    setCommentOpen(false);
    setActionsOpen(false);
    setReply("");
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: clamp(event.clientX - startPos.x, 8, ORB_SIZE - 8),
      offsetY: clamp(event.clientY - startPos.y, 8, ORB_SIZE - 8),
      source: fromDock ? "dock" : "orb",
    };
  };

  const testAi = async () => {
    if (aiTesting) return;
    setAiTesting(true);
    setAiSettingsNotice("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Reply with: SuperNova AI ready." }),
      });
      const data = await response.json().catch(() => ({}));
      setAiSettingsNotice(hasUsableAiReply(response, data) ? "AI is working." : aiConfigMessage(data));
    } catch {
      setAiSettingsNotice("AI unavailable; fallback text will be used.");
    } finally {
      setAiTesting(false);
    }
  };

  const closeActivePanel = () => {
    setSettingsOpen(false);
    setCommentOpen(false);
    setActionsOpen(false);
    setReply("");
    setBusy(false);
    if (target) setMenuOpen(true);
    setGhostVisible(true);
  };

  const loadConnectorActions = useCallback(async () => {
    setConnectorActionsLoading(true);
    setConnectorActionsError("");
    try {
      requireBackendAuthSession();
      const response = await fetch(`${API_BASE_URL}/connector/actions?status=draft&limit=50`, {
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Unable to load AI Actions."));
      }
      setConnectorActions(Array.isArray(payload?.actions) ? payload.actions : []);
    } catch (error) {
      setConnectorActions([]);
      setConnectorActionsError(formatBackendAuthErrorMessage(error, BACKEND_AUTH_MISSING_MESSAGE));
    } finally {
      setConnectorActionsLoading(false);
    }
  }, []);

  const loadCollabRequests = useCallback(async () => {
    setCollabRequestsLoading(true);
    setCollabRequestsError("");
    try {
      requireBackendAuthSession();
      const fetchRole = async (role) => {
        const response = await fetch(`${API_BASE_URL}/proposal-collabs?role=${role}&status=pending&limit=50`, {
          headers: authHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Unable to load collab requests."));
        }
        return Array.isArray(payload?.collabs) ? payload.collabs : [];
      };
      const [incoming, outgoing] = await Promise.all([fetchRole("collaborator"), fetchRole("author")]);
      setCollabIncoming(incoming);
      setCollabOutgoing(outgoing);
    } catch (error) {
      setCollabIncoming([]);
      setCollabOutgoing([]);
      setCollabRequestsError(formatBackendAuthErrorMessage(error, BACKEND_AUTH_MISSING_MESSAGE));
    } finally {
      setCollabRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleAiActionsRefresh = (event) => {
      const notice = event?.detail?.notice || "AI Action draft queued for review.";
      setMenuOpen(false);
      setSettingsOpen(false);
      setCommentOpen(false);
      setActionsOpen(true);
      setReply("");
      setGhostVisible(true);
      setConnectorActionsNotice(notice);
      Promise.allSettled([loadConnectorActions(), loadCollabRequests()]);
    };

    window.addEventListener("supernova:ai-actions-refresh", handleAiActionsRefresh);
    return () => window.removeEventListener("supernova:ai-actions-refresh", handleAiActionsRefresh);
  }, [loadCollabRequests, loadConnectorActions, mounted]);

  const reviewConnectorAction = async (action, reviewAction) => {
    if (!action?.id || connectorActionBusyId) return;
    setConnectorActionBusyId(`${reviewAction}:${action.id}`);
    setConnectorActionsError("");
    setConnectorActionsNotice("");
    try {
      requireBackendAuthSession();
      const approveEndpoint =
        action.action_type === "draft_ai_review"
          ? `${API_BASE_URL}/connector/actions/${action.id}/approve-ai-review`
          : action.action_type === "draft_ai_comment"
          ? `${API_BASE_URL}/connector/actions/${action.id}/approve-ai-comment`
          : action.action_type === "draft_ai_post"
          ? `${API_BASE_URL}/connector/actions/${action.id}/approve-ai-post`
          : `${API_BASE_URL}/connector/actions/${action.id}/approve-vote`;
      const endpoint =
        reviewAction === "approve"
          ? approveEndpoint
          : `${API_BASE_URL}/connector/actions/${action.id}/cancel`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Unable to update AI Action."));
      }
      if (reviewAction === "approve") {
        const summary = payload?.summary || {};
        const draftPayload = action.draft_payload || {};
        const proposalId = summary.proposal_id || draftPayload.proposal_id || action.target_id;
        if ((action.action_type === "draft_ai_review" || action.action_type === "draft_ai_comment") && summary.comment) {
          window.dispatchEvent(
            new CustomEvent("supernova:post-action", {
              detail: {
                id: summary.comment.proposal_id || proposalId,
                action: "comment-posted",
                comment: summary.comment,
              },
            })
          );
        }
        if (action.action_type === "draft_ai_review" && proposalId && summary.vote) {
          window.dispatchEvent(
            new CustomEvent("supernova:post-action", {
              detail: {
                id: proposalId,
                action: "vote-recorded",
                vote: summary.vote,
                voter: summary.actor || draftPayload.ai_actor_username || connectorActionActorLabel(action),
                voter_type: "ai",
              },
            })
          );
        }
        if (action.action_type === "draft_ai_post" && summary.post) {
          window.dispatchEvent(new CustomEvent("supernova:post-created", { detail: { post: summary.post } }));
        }
        queryClient.invalidateQueries({ queryKey: ["home-feed"] });
        queryClient.invalidateQueries({ queryKey: ["proposals"] });
        queryClient.invalidateQueries({ queryKey: ["ai-actions"] });
      }
      setConnectorActions((items) => items.filter((item) => item.id !== action.id));
      setConnectorActionsNotice(
        reviewAction === "approve"
          ? action.action_type === "draft_ai_review"
            ? `Published as ${connectorActionActorLabel(action)}.`
            : action.action_type === "draft_ai_comment"
            ? `Published as ${connectorActionActorLabel(action)}.`
            : action.action_type === "draft_ai_post"
            ? `Published as ${connectorActionActorLabel(action)}.`
            : "Vote action approved."
          : "Canceled - nothing published."
      );
    } catch (error) {
      setConnectorActionsError(formatBackendAuthErrorMessage(error, "Unable to update AI Action."));
    } finally {
      setConnectorActionBusyId(null);
    }
  };

  const openDelegateAction = (mode = "review") => {
    if (!target?.id) {
      setReply("Drag the AI cursor onto a post first.");
      setMenuOpen(true);
      return;
    }
    if (!isAuthenticated) {
      setMenuOpen(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
      }
      return;
    }
    window.dispatchEvent(
      new CustomEvent("supernova:open-ai-delegate-action", {
        detail: { proposalId: target.id, mode },
      })
    );
    setSettingsOpen(false);
    setCommentOpen(false);
    setActionsOpen(false);
    setMenuOpen(false);
    setReply("");
    setGhostVisible(false);
    dockRef.current?.classList.remove("ai-cursor-dock-hidden");
  };

  const runAction = async (action) => {
    if (action === "universe") {
      setMenuOpen(false);
      setSettingsOpen(false);
      setCommentOpen(false);
      setActionsOpen(false);
      setReply("");
      setGhostVisible(false);
      dockRef.current?.classList.remove("ai-cursor-dock-hidden");
      router.push("/universe");
      return;
    }

    if (action === "key") {
      setSettingsOpen((value) => !value);
      setCommentOpen(false);
      setActionsOpen(false);
      setReply("");
      setMenuOpen(Boolean(target));
      return;
    }

    if (action === "actions") {
      setMenuOpen(false);
      setSettingsOpen(false);
      setCommentOpen(false);
      setActionsOpen(true);
      setReply("");
      setGhostVisible(true);
      setConnectorActionsNotice("");
      await Promise.allSettled([loadConnectorActions(), loadCollabRequests()]);
      return;
    }

    if (!target && action !== "key") {
      setReply("Drag the AI cursor onto a post first.");
      setMenuOpen(true);
      return;
    }

    if (action === "like" || action === "dislike") {
      if (!isAuthenticated) {
        setMenuOpen(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
        }
        return;
      }
      const shouldRemove = lastSignal === action;
      window.dispatchEvent(
        new CustomEvent("supernova:post-action", {
          detail: { id: target.id, action, source: "ai-widget", allowToggle: shouldRemove },
        })
      );
      setLastSignal(shouldRemove ? null : action);
      setTarget((value) => (value ? { ...value, userVote: shouldRemove ? "" : action } : value));
      setReply("");
      setSettingsOpen(false);
      setCommentOpen(false);
      setActionsOpen(false);
      setMenuOpen(true);
      return;
    }

    if (action === "delegate_review") {
      openDelegateAction("review");
      return;
    }

    if (action === "engage") {
      openDelegateAction("comment");
      return;
    }

    if (action === "comment") {
      if (!isAuthenticated) {
        setMenuOpen(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
        }
        return;
      }
      setCommentText("");
      setCommentOpen(true);
      setMenuOpen(true);
      setSettingsOpen(false);
      setActionsOpen(false);
      setReply("");
      return;
    }

    if (action === "share") {
      const url = `${window.location.origin}/proposals/${target.id}`;
      try {
        await navigator.clipboard?.writeText?.(url);
        setReply("Post link copied.");
        setMenuOpen(true);
      } catch {
        setReply(url);
        setMenuOpen(true);
      }
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(action, target) }),
      });
      const data = await response.json().catch(() => ({}));
      const aiReply = hasUsableAiReply(response, data)
        ? data.reply
        : `AI was unavailable, so fallback text was used.\n\n${fallbackFor(action, target)}`;
      setReply(aiReply);
      setMenuOpen(true);
    } catch {
      setReply(`AI was unavailable, so fallback text was used.\n\n${fallbackFor(action, target)}`);
      setMenuOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    const value = commentText.trim();
    if (!target || !value) return;
    if (!isAuthenticated || !userData?.name) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
      }
      return;
    }

    setCommentSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          proposal_id: Number(target.id),
          user: userData.name,
          user_img: normalizeAvatarValue(userData.avatar || ""),
          species: userData.species || "human",
          comment: value,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(formatBackendAuthErrorMessage(payload?.detail, "Comment failed."));
      }

      const payload = await response.json().catch(() => ({}));
      const newComment = payload?.comments?.[0] || {
        proposal_id: Number(target.id),
        user: userData.name,
        user_img: normalizeAvatarValue(userData.avatar || ""),
        species: userData.species || "human",
        comment: value,
      };
      window.dispatchEvent(
        new CustomEvent("supernova:post-action", {
          detail: { id: target.id, action: "comment-posted", comment: newComment },
        })
      );
      setCommentText("");
      setCommentOpen(false);
      setReply("Comment posted.");
      setMenuOpen(true);
    } catch (error) {
      setReply(formatBackendAuthErrorMessage(error, "Comment failed."));
    } finally {
      setCommentSending(false);
    }
  };

  const actions = [
    { action: "dislike", label: "Challenge", icon: BiSolidDislike, dx: -56, dy: -88, size: "primary", tone: "blue" },
    { action: "like", label: "Support", icon: BiSolidLike, dx: 56, dy: -88, size: "primary", tone: "pink" },
    { action: "actions", label: "AI Actions", icon: IoListCircleOutline, dx: 0, dy: -124, tone: "blue" },
    { action: "comment", label: "Comment", icon: FaCommentAlt, dx: -100, dy: -28 },
    { action: "delegate_review", label: "AI Review", icon: IoSparklesOutline, dx: 100, dy: -28 },
    { action: "engage", label: "AI Comment", icon: IoChatbubbleEllipsesOutline, dx: -90, dy: 48 },
    { action: "share", label: "Share", icon: FaShare, dx: 90, dy: 48 },
    { action: "universe", label: "Universe", icon: IoPlanetOutline, dx: -34, dy: 96 },
    { action: "key", label: "AI Settings", icon: IoKeyOutline, dx: 34, dy: 96 },
  ];
  const dockHidden = dragging || ghostVisible || menuOpen || settingsOpen || commentOpen || actionsOpen || Boolean(reply);
  const floatingPanelStyle =
    mounted && typeof window !== "undefined"
      ? (() => {
          const width = Math.min(window.innerWidth - 16, 352);
          const viewport = window.visualViewport;
          const viewportTop = viewport?.offsetTop || 0;
          const viewportHeight = viewport?.height || window.innerHeight;
          const panelHeight = actionsOpen ? 488 : commentOpen ? 246 : settingsOpen ? 330 : 168;
          const rightRoom = window.innerWidth - (pos.x + ORB_SIZE + 12);
          const leftRoom = pos.x - 12;
          const canUseSide = Math.max(rightRoom, leftRoom) >= width;
          const desiredLeft =
            canUseSide && rightRoom >= leftRoom
              ? pos.x + ORB_SIZE + 12
              : canUseSide
              ? pos.x - width - 12
              : 8;
          const desiredTop = canUseSide
            ? pos.y + ORB_SIZE / 2 - panelHeight / 2
            : pos.y > window.innerHeight / 2
            ? pos.y - panelHeight - 92
            : pos.y + ORB_SIZE + 92;
          const minTop = Math.max(72, viewportTop + 8);
          const maxTop = Math.max(minTop, viewportTop + viewportHeight - panelHeight - 8);
          return {
            width: `${width}px`,
            left: `${clamp(desiredLeft, 8, window.innerWidth - width - 8)}px`,
            top: `${clamp(desiredTop, minTop, maxTop)}px`,
          };
        })()
      : {};

  const floatingUi = (
    <>
      {ghostVisible && (
        <div
          ref={orbRef}
          data-ai-cursor-root
          className={`fixed z-[2147482500] ${dragging ? "" : "transition-[left,top,opacity,transform] duration-500 ease-out"} ${
            returning ? "ai-cursor-returning scale-75 opacity-60" : "scale-100 opacity-100"
          }`}
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        >
          <button
            data-ai-cursor-root
            type="button"
            onPointerDown={startDrag}
            aria-label="Drag SuperNova AI cursor"
            className={`ai-cursor-core flex h-14 w-14 items-center justify-center rounded-full text-white ${
              dragging ? "scale-105 cursor-grabbing" : "cursor-grab"
            }`}
          >
            <AiWidgetIcon className="text-[1.7rem]" />
          </button>
        </div>
      )}

      {dragging && hoverTarget && (
        <div
          data-ai-cursor-root
          className="ai-cursor-tooltip pointer-events-none fixed z-[2147482502] max-w-[15rem] rounded-full px-3 py-2 text-[0.72rem] font-semibold backdrop-blur-xl"
          style={{
            left: clamp(pos.x - 82, 8, window.innerWidth - 248),
            top: Math.max(80, pos.y - 44),
          }}
        >
          Targeting {hoverTarget.title}
        </div>
      )}

      {menuOpen && (
        <>
          <div
            data-ai-cursor-root
            className="pointer-events-none fixed z-[2147482500] rounded-full ai-cursor-dial"
            style={{
              left: pos.x + ORB_SIZE / 2 - DIAL_SIZE / 2,
              top: pos.y + ORB_SIZE / 2 - DIAL_SIZE / 2,
              "--ai-dial-size": `${DIAL_SIZE}px`,
            }}
          />
          {actions.map((item) => {
            const Icon = item.icon;
            const buttonSize = item.size === "primary" ? 46 : 42;
            const centerX = pos.x + ORB_SIZE / 2;
            const centerY = pos.y + ORB_SIZE / 2;
            const signalActive = item.action === lastSignal;
            return (
              <button
                key={item.action}
                data-ai-cursor-root
                data-active={signalActive ? "true" : "false"}
                data-tone={item.tone || "neutral"}
                type="button"
                onClick={() => runAction(item.action)}
                className="ai-cursor-action-button fixed z-[2147482502] flex items-center justify-center rounded-full backdrop-blur-xl transition-transform active:scale-95"
                style={{
                  left: clamp(centerX + item.dx - buttonSize / 2, 8, window.innerWidth - buttonSize - 8),
                  top: clamp(centerY + item.dy - buttonSize / 2, 72, window.innerHeight - buttonSize - 8),
                  width: buttonSize,
                  height: buttonSize,
                }}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className={item.size === "primary" ? "text-[1.16rem]" : "text-[1rem]"} />
              </button>
            );
          })}
        </>
      )}

      {(settingsOpen || commentOpen || actionsOpen || busy || reply) && (
        <AssistantOrbShell
          panelStyle={floatingPanelStyle}
          title={settingsOpen ? "AI Settings" : commentOpen ? "Comment" : actionsOpen ? "AI Actions" : "AI Cursor"}
          subtitle={
            settingsOpen
              ? "Drag onto a post, then choose Brief or Draft"
              : actionsOpen
              ? "Approve or cancel drafts"
              : target
              ? target.title
              : "Drag onto a post first"
          }
          onClose={closeActivePanel}
        >
          {settingsOpen && (
            <AssistantSettingsPanel
              aiTesting={aiTesting}
              notice={aiSettingsNotice}
              onTestAi={testAi}
              onOpenActions={() => {
                setSettingsOpen(false);
                setActionsOpen(true);
                setConnectorActionsNotice("");
                loadConnectorActions();
                loadCollabRequests();
              }}
              onUseAiDelegate={() => openDelegateAction("review")}
              onOpenAiGenesis={() => {
                setSettingsOpen(false);
                setMenuOpen(false);
                setGhostVisible(false);
                dockRef.current?.classList.remove("ai-cursor-dock-hidden");
                router.push("/settings/ai-delegates");
              }}
            />
          )}

          {commentOpen && (
            <AssistantCommentPanel
              commentInputRef={commentInputRef}
              value={commentText}
              onChange={(event) => {
                setCommentText(event.target.value);
                mentionAutocomplete.trackCaret(event.currentTarget);
              }}
              onClick={(event) => mentionAutocomplete.trackCaret(event.currentTarget)}
              onKeyDown={mentionAutocomplete.handleKeyDown}
              onKeyUp={(event) => mentionAutocomplete.trackCaret(event.currentTarget)}
              mentionAutocompleteNode={<MentionAutocomplete controller={mentionAutocomplete} withinAiCursor />}
              onCancel={closeActivePanel}
              onSubmit={submitComment}
              submitDisabled={!commentText.trim() || commentSending}
              submitting={commentSending}
            />
          )}

          {actionsOpen && (
            <div className="mt-3 flex flex-col gap-2">
              <AssistantAiActionsList
                actions={connectorActions}
                busyId={connectorActionBusyId}
                error={connectorActionsError}
                loading={connectorActionsLoading}
                notice={connectorActionsNotice}
                onApprove={(action) => reviewConnectorAction(action, "approve")}
                onCancel={(action) => reviewConnectorAction(action, "cancel")}
                onRefresh={() => {
                  setConnectorActionsNotice("");
                  loadConnectorActions();
                  loadCollabRequests();
                }}
                refreshDisabled={connectorActionsLoading || collabRequestsLoading}
              />

              <AssistantCollabRequestsPanel
                error={collabRequestsError}
                incomingCount={collabIncoming.length}
                loading={collabRequestsLoading}
                onOpenProfile={() => {
                  setActionsOpen(false);
                  setMenuOpen(false);
                  if (userData?.name) router.push(`/users/${encodeURIComponent(userData.name)}`);
                }}
                outgoingCount={collabOutgoing.length}
              />
            </div>
          )}

          {(busy || reply) && (
            <AssistantStatusBox className="mt-3 max-h-36 overflow-y-auto rounded-[0.85rem] p-3 text-[0.78rem] leading-5">
              {busy ? "Thinking..." : reply}
            </AssistantStatusBox>
          )}
        </AssistantOrbShell>
      )}
    </>
  );

  return (
    <>
      <button
        ref={dockRef}
        data-ai-cursor-root
        type="button"
        onPointerDown={startDrag}
        aria-label="SuperNova AI cursor"
        aria-hidden={dockHidden}
        className={`mobile-topbar-action ai-cursor-dock flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-all duration-150 ${
          dockHidden ? "ai-cursor-dock-hidden pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <AiWidgetIcon className="text-[1.12rem]" />
      </button>

      {mounted && typeof document !== "undefined" ? createPortal(floatingUi, document.body) : null}
    </>
  );
}

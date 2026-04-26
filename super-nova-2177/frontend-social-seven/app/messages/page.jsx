"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoLockClosedOutline, IoPaperPlaneOutline, IoSearchOutline } from "react-icons/io5";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl, normalizeAvatarValue } from "@/utils/avatar";
import LinkifiedText from "@/utils/linkify";
import { useUser } from "@/content/profile/UserContext";

function avatarUrl(value) {
  return normalizeAvatarValue(value) ? avatarDisplayUrl(value) : "";
}

function initials(name = "SN") {
  return name.slice(0, 2).toUpperCase();
}

function compactName(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]} ${words[1]}`;
  return name;
}

function peerKey(value = "") {
  return value.trim().toLowerCase();
}

function translateUrl(text = "") {
  return `https://translate.google.com/?sl=auto&tl=en&op=translate&text=${encodeURIComponent(text)}`;
}

const READ_PREFIX = "supernova_dm_seen::";
const SHARE_DRAFT_KEY = "supernova_dm_share_draft";

export default function MessagesPage() {
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const queryClient = useQueryClient();
  const messageBoxRef = useRef(null);
  const threadPaneRef = useRef(null);
  const [selectedPeer, setSelectedPeer] = useState("");
  const [requestedPeer, setRequestedPeer] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [readMarkers, setReadMarkers] = useState({});
  const [pendingShare, setPendingShare] = useState(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const shareDraftLoadedRef = useRef(false);
  const currentUser = isAuthenticated ? userData?.name?.trim() || "" : "";
  const readKey = `${READ_PREFIX}${peerKey(currentUser)}::`;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const readPeerFromUrl = () => {
      const nextPeer = new URLSearchParams(window.location.search).get("to")?.trim() || "";
      if (!nextPeer) return;
      setSearch("");
      setRequestedPeer(nextPeer);
    };

    const notifyRouteChange = () => window.dispatchEvent(new Event("supernova:location-change"));
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushStateWithMessageSync(...args) {
      const result = originalPushState.apply(this, args);
      notifyRouteChange();
      return result;
    };
    window.history.replaceState = function replaceStateWithMessageSync(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyRouteChange();
      return result;
    };

    readPeerFromUrl();
    window.addEventListener("popstate", readPeerFromUrl);
    window.addEventListener("supernova:location-change", readPeerFromUrl);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", readPeerFromUrl);
      window.removeEventListener("supernova:location-change", readPeerFromUrl);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || shareDraftLoadedRef.current || typeof window === "undefined") return;
    shareDraftLoadedRef.current = true;
    try {
      const raw = sessionStorage.getItem(SHARE_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(SHARE_DRAFT_KEY);
      const payload = JSON.parse(raw);
      const text = String(payload?.text || "").trim();
      if (!text) return;
      setPendingShare({ title: payload?.title || "Shared post", url: payload?.url || "" });
      setDraft((current) => (current.trim() ? current : text));
    } catch {
      try {
        sessionStorage.removeItem(SHARE_DRAFT_KEY);
      } catch {
        // Storage may be blocked; ignore and leave messaging usable.
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextMarkers = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(readKey)) {
        nextMarkers[key.slice(readKey.length)] = localStorage.getItem(key) || "";
      }
    }
    setReadMarkers(nextMarkers);
  }, [readKey]);

  const usersQuery = useQuery({
    queryKey: ["social-users", currentUser],
    enabled: Boolean(isAuthenticated && currentUser),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/social-users?username=${encodeURIComponent(currentUser)}`);
      if (!response.ok) throw new Error("Failed to load users");
      return response.json();
    },
  });

  const conversationsQuery = useQuery({
    queryKey: ["direct-conversations", currentUser],
    enabled: Boolean(isAuthenticated && currentUser),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/messages?user=${encodeURIComponent(currentUser)}`);
      if (!response.ok) throw new Error("Failed to load conversations");
      return response.json();
    },
    refetchInterval: 4000,
  });

  const peers = useMemo(() => {
    const conversationPeers = new Map(
      (conversationsQuery.data?.conversations || []).map((conversation) => [
        peerKey(conversation.peer),
        conversation,
      ])
    );
    const merged = new Map();
    (usersQuery.data || [])
      .filter((user) => user.username && peerKey(user.username) !== peerKey(currentUser))
      .forEach((user) => merged.set(peerKey(user.username), {
        ...user,
        conversation: conversationPeers.get(peerKey(user.username)),
      }));

    (conversationsQuery.data?.conversations || []).forEach((conversation) => {
      const username = conversation.peer || "";
      const key = peerKey(username);
      if (!username || key === peerKey(currentUser) || merged.has(key)) return;
      merged.set(key, {
        username,
        initials: initials(username),
        species: "human",
        avatar: "",
        post_count: 0,
        conversation,
      });
    });

    const requestedUsername = requestedPeer.trim();
    const requestedKey = peerKey(requestedUsername);
    if (requestedUsername && requestedKey !== peerKey(currentUser) && !merged.has(requestedKey)) {
      merged.set(requestedKey, {
        username: requestedUsername,
        initials: initials(requestedUsername),
        species: "human",
        avatar: "",
        post_count: 0,
      });
    }

    return Array.from(merged.values())
      .sort((left, right) => {
        const leftTime = left.conversation?.updated_at || "";
        const rightTime = right.conversation?.updated_at || "";
        return rightTime.localeCompare(leftTime);
      })
      .filter((user) => peerKey(user.username).includes(peerKey(search)));
  }, [conversationsQuery.data, currentUser, requestedPeer, search, usersQuery.data]);

  const unreadPeerKeys = useMemo(() => {
    return new Set(
      (conversationsQuery.data?.conversations || [])
        .filter((conversation) => {
          const message = conversation.last_message || {};
          if (peerKey(message.recipient) !== peerKey(currentUser)) return false;
          const conversationPeerKey = peerKey(conversation.peer);
          return conversationPeerKey && (readMarkers[conversationPeerKey] || "") < (message.created_at || "");
        })
        .map((conversation) => peerKey(conversation.peer))
    );
  }, [conversationsQuery.data, currentUser, readMarkers]);

  useEffect(() => {
    if (requestedPeer) {
      const requested = peers.find((peer) => peerKey(peer.username) === peerKey(requestedPeer));
      if (requested) {
        setSelectedPeer(requested.username);
        setRequestedPeer("");
        return;
      }
      return;
    }
    const selectedKey = peerKey(selectedPeer);
    if (peers.length > 0 && (!selectedKey || !peers.some((peer) => peerKey(peer.username) === selectedKey))) {
      setSelectedPeer(peers[0].username);
    }
  }, [peers, requestedPeer, selectedPeer]);

  const threadQuery = useQuery({
    queryKey: ["direct-thread", currentUser, selectedPeer],
    enabled: Boolean(isAuthenticated && currentUser && selectedPeer),
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/messages?user=${encodeURIComponent(currentUser)}&peer=${encodeURIComponent(selectedPeer)}`
      );
      if (!response.ok) throw new Error("Failed to load thread");
      return response.json();
    },
    refetchInterval: selectedPeer ? 4000 : false,
  });

  useEffect(() => {
    const textarea = messageBoxRef.current;
    if (!textarea) return;
    const maxHeight = 132;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft, selectedPeer]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const root = document.documentElement;
    let raf = 0;

    const updateViewport = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const visualHeight = Math.round(viewport?.height || window.innerHeight || 0);
        const keyboardLift = Math.max(0, Math.round((window.innerHeight || visualHeight) - visualHeight));
        const keyboardOpen = composerFocused && keyboardLift > 80;
        root.style.setProperty("--messages-visual-height", `${visualHeight}px`);
        root.classList.toggle("messages-keyboard-open", keyboardOpen);

        if (keyboardOpen && threadPaneRef.current) {
          threadPaneRef.current.scrollTo({
            top: threadPaneRef.current.scrollHeight,
            behavior: "auto",
          });
        }
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      root.classList.remove("messages-keyboard-open");
      root.style.removeProperty("--messages-visual-height");
    };
  }, [composerFocused]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Sign in to send messages.");
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUser,
          recipient: selectedPeer,
          body: draft.trim(),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || "Message failed");
      }
      return response.json();
    },
    onSuccess: (message) => {
      setDraft("");
      setPendingShare(null);
      queryClient.setQueryData(["direct-thread", currentUser, selectedPeer], (oldData) => {
        const existing = oldData?.messages || [];
        if (existing.some((item) => item.id === message.id)) return oldData;
        return {
          ...(oldData || {}),
          peer: selectedPeer,
          messages: [...existing, message],
        };
      });
      queryClient.setQueryData(["direct-conversations", currentUser], (oldData) => {
        const conversations = oldData?.conversations || [];
        const selectedPeerKey = peerKey(selectedPeer);
        return {
          conversations: [
            {
              peer: selectedPeer,
              last_message: message,
              updated_at: message.created_at,
            },
            ...conversations.filter((conversation) => peerKey(conversation.peer) !== selectedPeerKey),
          ],
        };
      });
      queryClient.invalidateQueries({ queryKey: ["direct-thread", currentUser, selectedPeer] });
      queryClient.invalidateQueries({ queryKey: ["direct-conversations", currentUser] });
    },
  });

  const selectedUser = peers.find((peer) => peer.username === selectedPeer);
  const messages = threadQuery.data?.messages || [];
  const selectedAvatar = avatarUrl(selectedUser?.avatar);

  const selectPeer = (username) => {
    if (!isAuthenticated) return;
    setRequestedPeer("");
    setSelectedPeer(username);
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", "/messages");
    }
  };

  useEffect(() => {
    const pane = threadPaneRef.current;
    if (!pane) return;
    pane.scrollTo({ top: pane.scrollHeight, behavior: "smooth" });
  }, [messages.length, selectedPeer]);

  useEffect(() => {
    if (!selectedPeer || messages.length === 0 || typeof window === "undefined") return;
    const lastMessage = messages[messages.length - 1];
    const selectedPeerKey = peerKey(selectedPeer);
    const lastSeen = lastMessage?.created_at || new Date().toISOString();
    localStorage.setItem(`${readKey}${selectedPeerKey}`, lastSeen);
    setReadMarkers((markers) => ({ ...markers, [selectedPeerKey]: lastSeen }));
    window.dispatchEvent(new Event("supernova:dm-read"));
  }, [messages, readKey, selectedPeer]);

  if (!isAuthenticated) {
    return (
      <div className="messages-shell social-shell pb-0">
        <section className="mobile-feed-panel social-panel mx-auto flex min-h-[calc(100dvh-var(--header-offset)-var(--dock-offset)-1rem)] max-w-[26rem] flex-col items-center justify-center rounded-[1.25rem] px-6 py-8 text-center">
          <img src={defaultAvatar} alt="" className="h-20 w-20 rounded-full object-cover shadow-[var(--shadow-pink)]" />
          <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-[var(--pink)]">
            <IoLockClosedOutline />
          </div>
          <h1 className="mt-4 text-[1.15rem] font-black">Messages unlock when you sign in.</h1>
          <p className="mt-2 max-w-[18rem] text-[0.86rem] leading-5 text-[var(--text-gray-light)]">
            Home and discovery stay public. Direct messages, votes, posts, and comments need your SuperNova account.
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }))}
            className="mt-5 rounded-full bg-[var(--pink)] px-5 py-2.5 text-[0.82rem] font-bold text-white shadow-[var(--shadow-pink)]"
          >
            Sign in
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="messages-shell social-shell pb-0">
      <div
        className="messages-layout flex min-h-0 flex-col gap-2.5"
      >
        <section className="mobile-feed-panel social-panel rounded-[1rem] px-3 py-3">
          <div className="flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-2">
            <IoSearchOutline className="shrink-0 text-[var(--text-gray-light)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find people"
              className="min-w-0 flex-1 bg-transparent text-[0.86rem] outline-none placeholder:text-[var(--text-gray-light)]"
            />
          </div>

          <div
            className="messages-user-rail hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1"
          >
            {usersQuery.isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <span key={index} className="load h-14 w-36 shrink-0 rounded-full" />
                ))
              : peers.map((peer) => {
                  const active = peer.username === selectedPeer;
                  const image = avatarUrl(peer.avatar);
                  const currentPeerKey = peerKey(peer.username);
                  const unread = unreadPeerKeys.has(currentPeerKey);
                  return (
                    <div
                      key={peer.username}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectPeer(peer.username)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectPeer(peer.username);
                        }
                      }}
                      className={`messages-user-chip relative flex w-[7.7rem] max-w-[7.7rem] shrink-0 items-center gap-2 overflow-hidden rounded-full px-2 py-2 text-left ${
                        active
                          ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                          : "bg-white/[0.045] text-[var(--text-black)]"
                      }`}
                    >
                      <Link
                        href={`/users/${encodeURIComponent(peer.username)}`}
                        className="relative z-10 shrink-0"
                        aria-label={`${peer.username} profile`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {image ? (
                          <img src={image} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-[0.68rem] font-bold">
                            {initials(peer.username)}
                          </span>
                        )}
                      </Link>
                      <button
                        type="button"
                        onClick={() => selectPeer(peer.username)}
                        title={peer.username}
                        className="min-w-0 flex-1 overflow-hidden text-left"
                      >
                        <span className="block max-w-full truncate text-[0.74rem] font-semibold">
                          {compactName(peer.username)}
                        </span>
                        <span className="block truncate text-[0.66rem] opacity-75">
                          {peer.conversation?.last_message?.body || `${peer.post_count || 0} posts`}
                        </span>
                      </button>
                      {unread && (
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.85)]" />
                      )}
                    </div>
                  );
                })}
          </div>
        </section>

        <section
          className="messages-chat-panel mobile-feed-panel social-panel flex flex-1 flex-col rounded-[1rem] px-3 py-3"
          style={{ minHeight: 0 }}
        >
          {selectedPeer ? (
            <>
              <div className="flex items-center justify-between gap-2 pb-3">
                <Link href={`/users/${encodeURIComponent(selectedPeer)}`} className="flex min-w-0 items-center gap-2">
                  {selectedAvatar ? (
                    <img src={selectedAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bgGray text-[0.72rem] font-bold">
                      {initials(selectedPeer)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9rem] font-semibold">{selectedPeer}</span>
                    <span className="block text-[0.68rem] text-[var(--text-gray-light)]">
                      {selectedUser?.species || "human"} signal
                    </span>
                  </span>
                </Link>
                <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[0.66rem] text-[var(--text-gray-light)]">
                  DM
                </span>
              </div>

              <div
                ref={threadPaneRef}
                className="messages-thread-pane hide-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-[0.95rem] bg-black/10 p-2 pb-3"
              >
                {threadQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <span key={index} className="load h-10 w-3/4 rounded-[1rem]" />
                  ))
                ) : messages.length === 0 ? (
                  <div className="m-auto max-w-[18rem] text-center text-[0.84rem] leading-5 text-[var(--text-gray-light)]">
                    Start the thread. Messages are saved by the SuperNova backend.
                  </div>
                ) : (
                  messages.map((message) => {
                    const own = peerKey(message.sender) === peerKey(currentUser);
                    return (
                      <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`message-bubble ${own ? "message-bubble-own" : "message-bubble-incoming"} max-w-[82%] rounded-[1rem] px-3 py-2 text-[0.86rem] leading-5 ${
                            own
                              ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                              : "bg-white/[0.065] text-[var(--transparent-black)]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            <LinkifiedText text={message.body} />
                          </p>
                          <a
                            href={translateUrl(message.body)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className={`mt-1 block text-[0.64rem] font-semibold ${
                              own ? "text-white/70" : "text-[var(--text-gray-light)]"
                            }`}
                          >
                            Translate
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                className="messages-composer mt-3 flex items-end gap-2 rounded-[1.15rem] border border-white/5 bg-[rgba(4,7,12,0.86)] p-2 backdrop-blur-xl"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (draft.trim() && selectedPeer && !sendMutation.isPending) sendMutation.mutate();
                }}
              >
                <textarea
                  ref={messageBoxRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => setComposerFocused(false)}
                  placeholder={`Message ${selectedPeer}`}
                  rows={1}
                  className="composer-textarea max-h-32 min-h-11 flex-1 resize-none overflow-hidden rounded-[1rem] border border-white/10 bg-white/[0.045] px-3 py-2.5 text-[0.88rem] outline-none placeholder:text-[var(--text-gray-light)]"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sendMutation.isPending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)] disabled:opacity-45"
                  aria-label="Send message"
                >
                  <IoPaperPlaneOutline />
                </button>
              </form>
              {pendingShare && (
                <div className="message-share-banner mt-2 rounded-[0.95rem] px-3 py-2 text-[0.74rem] leading-5">
                  Sharing a post here. Choose a person, then send when ready.
                </div>
              )}

              {sendMutation.isError && (
                <p className="mt-2 text-[0.74rem] text-[var(--pink)]">{sendMutation.error.message}</p>
              )}
            </>
          ) : (
            <div className="m-auto text-center text-[0.86rem] text-[var(--text-gray-light)]">
              No people found yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

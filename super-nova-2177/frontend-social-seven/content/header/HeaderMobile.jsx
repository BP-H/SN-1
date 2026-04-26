"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IoAdd,
  IoChatbubbleOutline,
  IoCompassOutline,
  IoHome,
  IoPersonOutline,
} from "react-icons/io5";
import LiquidGlass from "../liquid glass/LiquidGlass";
import { useUser } from "@/content/profile/UserContext";
import { API_BASE_URL } from "@/utils/apiBase";
import { authHeaders } from "@/utils/authSession";
import { usePageVisible } from "@/utils/pageVisibility";

const READ_PREFIX = "supernova_dm_seen::";
const HOME_SCROLL_TOP_KEY = "supernova-home-scroll-top";

export default function HeaderMobile({
  showSettings,
  setShowSettings,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { userData, isAuthenticated } = useUser();
  const [readMarkers, setReadMarkers] = useState({});
  const [isDesktopViewport, setIsDesktopViewport] = useState(null);
  const currentUser = isAuthenticated ? userData?.name?.trim() || "" : "";
  const pageVisible = usePageVisible();
  const readKey = `${READ_PREFIX}${currentUser.toLowerCase()}::`;

  const conversationsQuery = useQuery({
    queryKey: ["direct-conversations", currentUser],
    enabled: Boolean(isDesktopViewport === false && isAuthenticated && currentUser),
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_BASE_URL}/messages?user=${encodeURIComponent(currentUser)}`, {
        headers: authHeaders(),
        signal,
      });
      if (!response.ok) throw new Error("Failed to load conversations");
      return response.json();
    },
    refetchInterval: pageVisible ? 8000 : false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches);
    updateViewport();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateViewport);
      return () => mediaQuery.removeEventListener("change", updateViewport);
    }
    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refreshMarkers = () => {
      const nextMarkers = {};
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(readKey)) {
          nextMarkers[key.slice(readKey.length)] = localStorage.getItem(key) || "";
        }
      }
      setReadMarkers(nextMarkers);
    };
    refreshMarkers();
    window.addEventListener("storage", refreshMarkers);
    window.addEventListener("supernova:dm-read", refreshMarkers);
    return () => {
      window.removeEventListener("storage", refreshMarkers);
      window.removeEventListener("supernova:dm-read", refreshMarkers);
    };
  }, [readKey]);

  const unreadCount = useMemo(() => {
    return (conversationsQuery.data?.conversations || []).filter((conversation) => {
      const message = conversation.last_message || {};
      if (message.recipient?.toLowerCase() !== currentUser.toLowerCase()) return false;
      const peerKey = conversation.peer?.toLowerCase();
      return peerKey && (readMarkers[peerKey] || "") < (message.created_at || "");
    }).length;
  }, [conversationsQuery.data, currentUser, readMarkers]);

  const triggerComposer = () => {
    if (!isAuthenticated) {
      window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
      return;
    }
    if (typeof document === "undefined") return;
    setShowSettings(false);
    const button = document.getElementById("global-create-post-btn");
    if (button) {
      // If we are already on the home feed, just click the hidden toggle button and scroll up
      button.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // If we are on another page (like Messages), set a flag and navigate to home
      sessionStorage.setItem("autoOpenComposer", "true");
      router.push("/");
    }
  };

  const goHome = () => {
    setShowSettings(false);
    window.dispatchEvent(new Event("supernova:show-header"));
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    sessionStorage.setItem(HOME_SCROLL_TOP_KEY, "1");
    router.push("/");
  };

  const items = [
    { key: "home", label: "Home", icon: IoHome, onClick: goHome },
    {
      key: "discover",
      label: "Discover",
      icon: IoCompassOutline,
      onClick: () => { setShowSettings(false); router.push("/proposals"); },
    },
    {
      key: "create",
      label: "",
      icon: IoAdd,
      onClick: triggerComposer,
      isPrimary: true,
    },
    {
      key: "messages",
      label: "Messages",
      icon: IoChatbubbleOutline,
      onClick: () => {
        if (!isAuthenticated) {
          window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
          return;
        }
        setShowSettings(false);
        router.push("/messages");
      },
    },
    {
      key: "profile",
      label: "Profile",
      icon: IoPersonOutline,
      onClick: () => {
        if (!isAuthenticated) {
          window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
          return;
        }
        setShowSettings((value) => !value);
      },
    },
  ];

  const isActive = (key) => {
    if (key === "home") return pathname === "/";
    if (key === "discover") return pathname.startsWith("/proposals");
    if (key === "messages") return pathname.startsWith("/messages");
    if (key === "profile") return pathname.startsWith("/profile") || showSettings;
    return false;
  };

  return (
    <div data-mobile-nav className="mobile-bottom-shell fixed inset-x-0 bottom-0 z-[9400] w-full">
      <div className="relative">
        <LiquidGlass className="mobile-bottom-nav rounded-[1.75rem] px-0 py-0">
          <div className="mobile-nav-grid grid grid-cols-5 items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.key);

              if (item.isPrimary) {
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-label="Create post"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      item.onClick();
                    }}
                    className="mobile-nav-primary mx-auto flex h-12 w-12 translate-y-0 items-center justify-center self-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                  >
                    <Icon className="text-[1.55rem]" />
                  </button>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  aria-label={item.label}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    item.onClick();
                  }}
                  className="mobile-nav-item relative flex min-h-[3.6rem] flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-2"
                >
                  <Icon
                    className={`text-[1.34rem] ${
                      active ? "text-[var(--pink)]" : "text-[var(--text-gray-light)]"
                    }`}
                  />
                  {item.key === "messages" && unreadCount > 0 && (
                    <span className="absolute right-[30%] top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--pink)] px-1 text-[0.56rem] font-bold text-white shadow-[var(--shadow-pink)]">
                      {Math.min(unreadCount, 9)}
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-[var(--pink)] shadow-[var(--shadow-pink)]" />
                  )}
                  <span
                    className={`mobile-nav-label text-center text-[0.64rem] ${
                      active ? "font-semibold text-[var(--pink)]" : "text-[var(--text-gray-light)]"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </LiquidGlass>
      </div>
    </div>
  );
}

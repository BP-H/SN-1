"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  IoAdd,
  IoChatbubbleOutline,
  IoCompassOutline,
  IoHome,
  IoMenu,
  IoPersonOutline,
  IoSettingsOutline,
} from "react-icons/io5";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl } from "@/utils/avatar";
import { useUser } from "@/content/profile/UserContext";

const READ_PREFIX = "supernova_dm_seen::";

export default function DesktopNav({ showSettings, setShowSettings }) {
  const router = useRouter();
  const pathname = usePathname();
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const [readMarkers, setReadMarkers] = useState({});
  const [isDesktopViewport, setIsDesktopViewport] = useState(null);
  const currentUser = isAuthenticated ? userData?.name?.trim() || "" : "";
  const readKey = `${READ_PREFIX}${currentUser.toLowerCase()}::`;
  const avatar = isAuthenticated ? avatarDisplayUrl(userData?.avatar, defaultAvatar) : defaultAvatar;

  const conversationsQuery = useQuery({
    queryKey: ["desktop-direct-conversations", currentUser],
    enabled: Boolean(isDesktopViewport === true && isAuthenticated && currentUser),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/messages?user=${encodeURIComponent(currentUser)}`);
      if (!response.ok) throw new Error("Failed to load conversations");
      return response.json();
    },
    refetchInterval: 12000,
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

  const requireAccount = () => {
    window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
  };

  const openProfile = () => {
    if (!isAuthenticated) {
      requireAccount();
      return;
    }
    setShowSettings((value) => !value);
  };

  const triggerComposer = () => {
    if (!isAuthenticated) {
      requireAccount();
      return;
    }
    setShowSettings(false);
    const button = document.getElementById("global-create-post-btn");
    if (button) {
      button.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    sessionStorage.setItem("autoOpenComposer", "true");
    router.push("/");
  };

  const openSupernovaMenu = () => {
    window.dispatchEvent(new Event("supernova:open-menu"));
  };

  const navItems = [
    { key: "menu", label: "Menu", icon: IoMenu, action: openSupernovaMenu },
    { key: "home", label: "Home", icon: IoHome, action: () => router.push("/") },
    { key: "discover", label: "Discover", icon: IoCompassOutline, action: () => router.push("/proposals") },
    {
      key: "messages",
      label: "Messages",
      icon: IoChatbubbleOutline,
      action: () => (isAuthenticated ? router.push("/messages") : requireAccount()),
      badge: unreadCount,
    },
    { key: "profile", label: "Profile", icon: IoPersonOutline, action: openProfile },
  ];

  const isActive = (key) => {
    if (key === "home") return pathname === "/";
    if (key === "discover") return pathname.startsWith("/proposals");
    if (key === "messages") return pathname.startsWith("/messages");
    if (key === "profile") return pathname.startsWith("/profile") || showSettings;
    return false;
  };

  return (
    <aside className="desktop-shell-nav">
      <button type="button" onClick={triggerComposer} className="desktop-compose-button">
        <IoAdd className="text-[1.25rem]" />
        <span>Create post</span>
      </button>

      <nav className="desktop-nav-list" aria-label="Desktop navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.action}
              className={`desktop-nav-item ${active ? "desktop-nav-item-active" : ""}`}
            >
              <Icon className="text-[1.18rem]" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge > 0 && <span className="desktop-nav-badge">{Math.min(item.badge, 9)}</span>}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={openProfile}
        className="desktop-account-card"
      >
        <img
          src={avatar}
          alt=""
          onError={(event) => {
            event.currentTarget.src = defaultAvatar;
          }}
          className="h-10 w-10 rounded-full object-cover"
        />
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[0.84rem] font-bold">
            {isAuthenticated ? userData?.name : "Sign in"}
          </span>
          <span className="block truncate text-[0.68rem] text-[var(--text-gray-light)]">
            {isAuthenticated ? userData?.species || "human" : "Activate identity"}
          </span>
        </span>
        <IoSettingsOutline className="shrink-0 text-[var(--text-gray-light)]" />
      </button>
    </aside>
  );
}

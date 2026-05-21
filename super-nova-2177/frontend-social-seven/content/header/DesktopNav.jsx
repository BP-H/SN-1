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
import { authHeaders } from "@/utils/authSession";
import { avatarDisplayUrl } from "@/utils/avatar";
import { useI18n } from "@/content/i18n/LocaleContext";
import { usePageVisible } from "@/utils/pageVisibility";
import { useUser } from "@/content/profile/UserContext";

const READ_PREFIX = "supernova_dm_seen::";
const HOME_SCROLL_TOP_KEY = "supernova-home-scroll-top";

export default function DesktopNav({ setShowSettings }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const [readMarkers, setReadMarkers] = useState({});
  const [isDesktopViewport, setIsDesktopViewport] = useState(null);
  const currentUser = isAuthenticated ? userData?.name?.trim() || "" : "";
  const pageVisible = usePageVisible();
  const readKey = `${READ_PREFIX}${currentUser.toLowerCase()}::`;
  const avatar = isAuthenticated ? avatarDisplayUrl(userData?.avatar, defaultAvatar) : defaultAvatar;

  const conversationsQuery = useQuery({
    queryKey: ["desktop-direct-conversations", currentUser],
    enabled: Boolean(isDesktopViewport === true && isAuthenticated && currentUser),
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_BASE_URL}/messages?user=${encodeURIComponent(currentUser)}`, {
        headers: authHeaders(),
        signal,
      });
      if (!response.ok) throw new Error("Failed to load conversations");
      return response.json();
    },
    refetchInterval: pageVisible ? 12000 : false,
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

  useEffect(() => {
    if (!pathname.startsWith("/messages") || !currentUser || typeof window === "undefined") return;
    const nextMarkers = {};
    (conversationsQuery.data?.conversations || []).forEach((conversation) => {
      const message = conversation.last_message || {};
      const peer = conversation.peer?.toLowerCase();
      if (!peer || message.recipient?.toLowerCase() !== currentUser.toLowerCase()) return;
      const createdAt = message.created_at || "";
      if (!createdAt) return;
      nextMarkers[peer] = createdAt;
      localStorage.setItem(`${readKey}${peer}`, createdAt);
    });
    if (Object.keys(nextMarkers).length > 0) {
      setReadMarkers((markers) => ({ ...markers, ...nextMarkers }));
      window.dispatchEvent(new Event("supernova:dm-read"));
    }
  }, [conversationsQuery.data, currentUser, pathname, readKey]);

  const requireAccount = () => {
    window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
  };

  const openProfile = () => {
    if (!isAuthenticated) {
      requireAccount();
      return;
    }
    setShowSettings(false);
    const username = userData?.name?.trim();
    router.push(username ? `/users/${encodeURIComponent(username)}` : "/profile");
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

  const navItems = [
    { key: "menu", label: t("common.menu"), icon: IoMenu, action: openSupernovaMenu },
    { key: "home", label: t("nav.home"), icon: IoHome, action: goHome },
    { key: "discover", label: t("nav.discover"), icon: IoCompassOutline, action: () => router.push("/proposals") },
    {
      key: "messages",
      label: t("nav.messages"),
      icon: IoChatbubbleOutline,
      action: () => (isAuthenticated ? router.push("/messages") : requireAccount()),
      badge: unreadCount,
    },
    { key: "profile", label: t("nav.profile"), icon: IoPersonOutline, action: openProfile },
  ];

  const isActive = (key) => {
    if (key === "home") return pathname === "/";
    if (key === "discover") return pathname.startsWith("/proposals");
    if (key === "messages") return pathname.startsWith("/messages");
    if (key === "profile") return pathname.startsWith("/profile") || pathname.startsWith("/users/");
    return false;
  };

  return (
    <aside className="desktop-shell-nav">
      <button type="button" onClick={triggerComposer} className="desktop-compose-button">
        <IoAdd className="text-[1.25rem]" />
        <span>{t("common.createPost")}</span>
      </button>

      <nav className="desktop-nav-list" aria-label={t("nav.desktopNavigation")}>
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
            {isAuthenticated ? userData?.name : t("account.signIn")}
          </span>
          <span className="block truncate text-[0.68rem] text-[var(--text-gray-light)]">
            {isAuthenticated ? userData?.species || "human" : t("account.activateIdentity")}
          </span>
        </span>
        <IoSettingsOutline className="shrink-0 text-[var(--text-gray-light)]" />
      </button>
    </aside>
  );
}

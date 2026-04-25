"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IoMenu, IoNotificationsOutline, IoSearchOutline } from "react-icons/io5";
import { FaGithub } from "react-icons/fa";
import LiquidGlass from "../liquid glass/LiquidGlass";
import AssistantOrb from "../AssistantOrb";
import NotificationsPanel from "./content/NotificationsPanel";
import SupernovaMenu from "./content/SupernovaMenu";
import { SearchInputContext } from "@/app/layout";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl } from "@/utils/avatar";
import { useUser } from "@/content/profile/UserContext";

export default function Header({
  errorMsg,
  setErrorMsg,
  setNotify,
  showSettings,
  setShowSettings,
}) {
  const { focusSearchInput } = useContext(SearchInputContext);
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [seenActivitySignature, setSeenActivitySignature] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const headerRef = useRef(null);
  const { data: activity } = useQuery({
    queryKey: ["header-notification-count"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/proposals?filter=latest&limit=3`);
      if (!response.ok) throw new Error("Failed to fetch notification count");
      return response.json();
    },
    staleTime: 30_000,
  });
  const activityItems = useMemo(() => (activity || []).slice(0, 3), [activity]);
  const activitySignature = activityItems.map((item) => item.id).join(":");
  const activityCount = activitySignature && seenActivitySignature !== activitySignature
    ? activityItems.length
    : 0;
  const avatar = isAuthenticated ? avatarDisplayUrl(userData?.avatar, defaultAvatar) : defaultAvatar;

  const handleSearch = () => {
    if (pathname === "/proposals") {
      focusSearchInput();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("supernova:focus-search"));
      }
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem("supernova-focus-search", "1");
    }
    router.push("/proposals");
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSeenActivitySignature(localStorage.getItem("supernova_seen_activity_signature") || "");
  }, []);

  useEffect(() => {
    const openSupernovaMenu = () => {
      setShowNotifications(false);
      setShowMenu(true);
      setHeaderHidden(false);
    };
    window.addEventListener("supernova:open-menu", openSupernovaMenu);
    return () => window.removeEventListener("supernova:open-menu", openSupernovaMenu);
  }, []);

  const markNotificationsSeen = () => {
    if (!activitySignature || typeof window === "undefined") return;
    localStorage.setItem("supernova_seen_activity_signature", activitySignature);
    setSeenActivitySignature(activitySignature);
  };

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY < 24 || currentY < lastY - 6) {
          setHeaderHidden(false);
        } else if (!showMenu && currentY > 96 && currentY > lastY + 8) {
          setHeaderHidden(true);
          setShowNotifications(false);
        }
        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showMenu]);

  return (
    <div
      className="mobile-top-shell fixed inset-x-0 top-0 z-[9300] w-full pt-0 transition-all duration-300 ease-out"
      style={{
        transform: headerHidden ? "translateY(-105%)" : "translateY(0)",
        opacity: headerHidden ? 0 : 1,
      }}
    >
      <div ref={headerRef} className="relative">
        <LiquidGlass className="mobile-topbar rounded-[1.65rem] px-4 py-2.5">
          <div className="mobile-top-content flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowNotifications(false);
                setShowMenu(true);
                setHeaderHidden(false);
              }}
              className="mobile-profile-menu-button relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              aria-label="Open SuperNova menu"
              title="Open SuperNova menu"
            >
              <img
                src={avatar}
                alt="profile"
                onError={(event) => {
                  event.currentTarget.src = defaultAvatar;
                }}
                className="h-11 w-11 rounded-full object-cover ring-1 ring-white/15"
              />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pink)] text-[0.78rem] text-white shadow-[var(--shadow-pink)] ring-1 ring-white/20">
                <IoMenu />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowNotifications(false);
                router.push("/");
              }}
              className="min-w-0 flex-1 overflow-hidden text-left"
              aria-label="Go home"
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="mobile-brand truncate text-[clamp(0.92rem,4vw,1.12rem)] font-black text-[var(--text-black)]">
                  SUPERN
                </span>
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--pink)] shadow-[var(--shadow-pink)]" />
                <span className="mobile-brand truncate text-[clamp(0.92rem,4vw,1.12rem)] font-black text-[var(--text-black)]">
                  VA
                </span>
                <span className="hidden shrink-0 text-[0.58rem] font-bold tracking-[0.26em] text-[var(--text-gray-light)] min-[380px]:inline">
                  2177
                </span>
              </div>
              <p className="mt-1 truncate text-[0.48rem] uppercase tracking-[0.32em] text-[var(--text-gray-light)]">
                AI x Humans x ORG
              </p>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <AssistantOrb />
              <a
                href="https://github.com/BP-H/SN-1"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mobile-topbar-action hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bgGray text-[var(--text-black)] min-[390px]:flex"
                aria-label="Open SuperNova GitHub repository"
                title="Open SuperNova GitHub repository"
              >
                <FaGithub className="text-[1.12rem]" />
              </a>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSearch();
                }}
                className="mobile-topbar-action flex h-10 w-10 shrink-0 items-center justify-center rounded-full bgGray text-[var(--text-black)]"
                aria-label="Search"
              >
                <IoSearchOutline className="text-[1.12rem]" />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowSettings(false);
                  setShowNotifications((value) => {
                    const next = !value;
                    if (next) markNotificationsSeen();
                    return next;
                  });
                }}
                className="mobile-topbar-action relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bgGray text-[var(--text-black)]"
                aria-label="Notifications"
              >
                <IoNotificationsOutline className="text-[1.12rem]" />
                {activityCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--pink)] text-[0.62rem] font-bold text-white shadow-[var(--shadow-pink)]">
                    {activityCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </LiquidGlass>

        {showNotifications && (
          <div className="absolute right-0 top-[calc(100%+0.65rem)] z-[99280] w-[min(19rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]">
            <NotificationsPanel onSelect={() => setShowNotifications(false)} />
          </div>
        )}
      </div>
      <SupernovaMenu
        open={showMenu}
        onClose={() => setShowMenu(false)}
        openProfileSettings={() => setShowSettings(true)}
      />
    </div>
  );
}

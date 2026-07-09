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
import { SearchInputContext } from "@/app/LayoutClient";
import { useI18n } from "@/content/i18n/LocaleContext";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl } from "@/utils/avatar";
import { useUser } from "@/content/profile/UserContext";

const HOME_SCROLL_TOP_KEY = "supernova-home-scroll-top";
const SEEN_ACTIVITY_PREFIX = "supernova_seen_activity_ids::";

function activityIdentity(item, index = 0) {
  const directId = item?.id || item?.notification_id || item?.comment_id || item?.proposal_id;
  if (directId) return String(directId);
  return [
    item?.type || "activity",
    item?.actor || "",
    item?.title || item?.body || "",
    item?.time || item?.created_at || "",
    index,
  ].join(":");
}

function loadSeenActivityIds(key) {
  if (typeof window === "undefined" || !key) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveSeenActivityIds(key, ids) {
  if (typeof window === "undefined" || !key) return;
  const unique = Array.from(new Set(ids.map(String))).slice(-80);
  localStorage.setItem(key, JSON.stringify(unique));
}

export default function Header({
  errorMsg,
  setErrorMsg,
  setNotify,
  showSettings,
  setShowSettings,
}) {
  const { focusSearchInput } = useContext(SearchInputContext);
  const { t } = useI18n();
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [seenActivityIds, setSeenActivityIds] = useState([]);
  const pathname = usePathname();
  const router = useRouter();
  const headerRef = useRef(null);
  const { data: activity } = useQuery({
    queryKey: ["header-notification-count", isAuthenticated, userData?.name || ""],
    queryFn: async () => {
      const endpoint = isAuthenticated && userData?.name
        ? `${API_BASE_URL}/notifications?user=${encodeURIComponent(userData.name)}&limit=12`
        : `${API_BASE_URL}/proposals?filter=latest&limit=12&embedded_comments_limit=3&embedded_votes_limit=25`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Failed to fetch notification count");
      return response.json();
    },
    staleTime: 30_000,
  });
  const activityItems = useMemo(() => (activity || []).slice(0, 12), [activity]);
  const activityIds = useMemo(
    () => activityItems.map((item, index) => activityIdentity(item, index)).filter(Boolean),
    [activityItems]
  );
  const seenActivitySet = useMemo(() => new Set(seenActivityIds), [seenActivityIds]);
  const activityCount = activityIds.filter((id) => !seenActivitySet.has(id)).length;
  const activityStorageKey = `${SEEN_ACTIVITY_PREFIX}${isAuthenticated && userData?.name ? userData.name.toLowerCase() : "public"}`;
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

  const goHome = () => {
    setShowNotifications(false);
    setHeaderHidden(false);
    window.dispatchEvent(new Event("supernova:show-header"));
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    sessionStorage.setItem(HOME_SCROLL_TOP_KEY, "1");
    router.push("/");
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

  /* Escape closes the notifications dropdown. */
  useEffect(() => {
    if (!showNotifications) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setShowNotifications(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSeenActivityIds(loadSeenActivityIds(activityStorageKey));
  }, [activityStorageKey]);

  useEffect(() => {
    const openSupernovaMenu = () => {
      setShowNotifications(false);
      setShowMenu(true);
      setHeaderHidden(false);
    };
    window.addEventListener("supernova:open-menu", openSupernovaMenu);
    return () => window.removeEventListener("supernova:open-menu", openSupernovaMenu);
  }, []);

  useEffect(() => {
    const showHeader = () => setHeaderHidden(false);
    window.addEventListener("supernova:show-header", showHeader);
    return () => window.removeEventListener("supernova:show-header", showHeader);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.headerHidden = headerHidden ? "true" : "false";
  }, [headerHidden]);

  const markNotificationsSeen = () => {
    if (!activityIds.length || typeof window === "undefined") return;
    const nextIds = Array.from(new Set([...seenActivityIds, ...activityIds]));
    saveSeenActivityIds(activityStorageKey, nextIds);
    setSeenActivityIds(nextIds);
  };

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");

    const handleScroll = () => {
      if (desktopQuery.matches) {
        setHeaderHidden(false);
        lastY = window.scrollY;
        return;
      }
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

    const keepDesktopHeaderVisible = () => {
      if (desktopQuery.matches) setHeaderHidden(false);
    };

    keepDesktopHeaderVisible();
    window.addEventListener("scroll", handleScroll, { passive: true });
    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener("change", keepDesktopHeaderVisible);
    } else {
      desktopQuery.addListener(keepDesktopHeaderVisible);
    }
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (desktopQuery.removeEventListener) {
        desktopQuery.removeEventListener("change", keepDesktopHeaderVisible);
      } else {
        desktopQuery.removeListener(keepDesktopHeaderVisible);
      }
    };
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
        <LiquidGlass className="mobile-topbar rounded-[1.65rem] px-4 py-2">
          <div className="mobile-top-content flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowNotifications(false);
                setShowMenu(true);
                setHeaderHidden(false);
              }}
              className="mobile-profile-menu-button relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              aria-label={t("header.openMenu")}
              title={t("header.openMenu")}
            >
              <img
                src={avatar}
                alt="profile"
                onError={(event) => {
                  event.currentTarget.src = defaultAvatar;
                }}
                className="h-10 w-10 rounded-full object-cover ring-1 ring-white/15"
              />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pink)] text-[0.78rem] text-white shadow-[var(--shadow-pink)] ring-1 ring-white/20">
                <IoMenu />
              </span>
            </button>

            <button
              type="button"
              onClick={goHome}
              className="min-w-0 flex-1 overflow-hidden text-left"
              aria-label={t("header.goHome")}
            >
              <div className="flex items-center gap-1 overflow-hidden">
                <span className="mobile-brand truncate text-[clamp(0.78rem,3.25vw,1rem)] font-black text-[var(--text-black)]">
                  SUPERN
                </span>
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--pink)] shadow-[var(--shadow-pink)]" />
                <span className="mobile-brand truncate text-[clamp(0.78rem,3.25vw,1rem)] font-black text-[var(--text-black)]">
                  VA
                </span>
                <span className="hidden shrink-0 text-[0.54rem] font-bold tracking-[0.18em] text-[var(--text-gray-light)] min-[400px]:inline">
                  2177
                </span>
              </div>
              {/* One-line brand on phones; the tagline returns on wider bars. */}
              <p className="mt-[3px] hidden truncate text-[0.46rem] uppercase tracking-[0.24em] text-[var(--text-gray-light)] min-[768px]:block">
                AI x Humans x ORG
              </p>
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              <AssistantOrb />
              <a
                href="https://github.com/BP-H/SN-1"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mobile-topbar-action hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bgGray text-[var(--text-black)] min-[460px]:flex"
                aria-label={t("header.openGithub")}
                title={t("header.openGithub")}
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
                aria-label={t("header.search")}
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
                aria-label={t("header.notifications")}
              >
                <IoNotificationsOutline className="text-[1.12rem]" />
                {activityCount > 0 && (
                  <span className="nav-badge-pop absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--pink)] px-1 text-[0.62rem] font-bold tabular-nums text-white shadow-[var(--shadow-pink)]">
                    {activityCount > 9 ? "9+" : activityCount}
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

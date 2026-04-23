"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IoNotificationsOutline, IoSearchOutline } from "react-icons/io5";
import LiquidGlass from "../liquid glass/LiquidGlass";
import NotificationsPanel from "./content/NotificationsPanel";
import { SearchInputContext } from "@/app/layout";
import { API_BASE_URL } from "@/utils/apiBase";

export default function Header({
  errorMsg,
  setErrorMsg,
  setNotify,
  showSettings,
  setShowSettings,
}) {
  const { focusSearchInput } = useContext(SearchInputContext);
  const [showNotifications, setShowNotifications] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const headerRef = useRef(null);
  const { data: activity } = useQuery({
    queryKey: ["header-notification-count"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/proposals?filter=latest`);
      if (!response.ok) throw new Error("Failed to fetch notification count");
      return response.json();
    },
    staleTime: 30_000,
  });
  const activityCount = Math.min((activity || []).length, 9);

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

  return (
    <div className="fixed left-1/2 top-0 z-[9002] shell-fixed -translate-x-1/2 pt-2">
      <div ref={headerRef} className="relative">
        <LiquidGlass className="rounded-[1.65rem] px-3.5 py-3 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[clamp(1.02rem,4.6vw,1.3rem)] font-black tracking-[0.24em] text-[var(--text-black)] sm:tracking-[0.28em]">
                  SUPERN
                </span>
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--pink)] shadow-[var(--shadow-pink)]" />
                <span className="truncate text-[clamp(1.02rem,4.6vw,1.3rem)] font-black tracking-[0.24em] text-[var(--text-black)] sm:tracking-[0.28em]">
                  VA
                </span>
                <span className="shrink-0 text-[0.64rem] font-bold tracking-[0.3em] text-[var(--text-gray-light)]">
                  2177
                </span>
              </div>
              <p className="mt-1 truncate text-[0.52rem] uppercase tracking-[0.24em] text-[var(--text-gray-light)] sm:tracking-[0.34em]">
                AI x Humans x ORG
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSearch();
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bgGray text-[var(--text-black)] sm:h-11 sm:w-11"
                aria-label="Search"
              >
                <IoSearchOutline className="text-[1.12rem]" />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowSettings(false);
                  setShowNotifications((value) => !value);
                }}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bgGray text-[var(--text-black)] sm:h-11 sm:w-11"
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
            <NotificationsPanel />
          </div>
        )}
      </div>
    </div>
  );
}

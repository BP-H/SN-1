"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  IoAdd,
  IoChatbubbleOutline,
  IoCompassOutline,
  IoHome,
  IoPersonOutline,
} from "react-icons/io5";
import LiquidGlass from "../liquid glass/LiquidGlass";

export default function HeaderMobile({
  showSettings,
  setShowSettings,
}) {
  const router = useRouter();
  const pathname = usePathname();

  const triggerComposer = () => {
    if (typeof document === "undefined") return;
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

  const items = [
    { key: "home", label: "Home", icon: IoHome, onClick: () => router.push("/") },
    {
      key: "discover",
      label: "Discover",
      icon: IoCompassOutline,
      onClick: () => router.push("/proposals"),
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
      onClick: () => router.push("/messages"),
    },
    {
      key: "profile",
      label: "Profile",
      icon: IoPersonOutline,
      onClick: () => {
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
    <div className="fixed bottom-3 left-1/2 z-[9000] shell-fixed -translate-x-1/2 md:bottom-4">
      <div className="relative">
        <LiquidGlass className="rounded-[1.75rem] px-2.5 py-2">
          <div className="grid grid-cols-5 items-center gap-1 sm:gap-2">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.key);

              if (item.isPrimary) {
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      item.onClick();
                    }}
                    className="mx-auto flex h-12 w-12 translate-y-0 items-center justify-center self-center rounded-full bg-[var(--pink)] text-white shadow-[var(--shadow-pink)] sm:h-14 sm:w-14 sm:translate-y-0"
                  >
                    <Icon className="text-[1.55rem]" />
                  </button>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    item.onClick();
                  }}
                  className="flex min-h-[3.6rem] flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-2"
                >
                  <Icon
                    className={`text-[1.24rem] sm:text-[1.32rem] ${
                      active ? "text-[var(--pink)]" : "text-[var(--text-gray-light)]"
                    }`}
                  />
                  <span
                    className={`text-center text-[0.64rem] sm:text-[0.7rem] ${
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

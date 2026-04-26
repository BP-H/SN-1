"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  IoBookmarkOutline,
  IoBriefcaseOutline,
  IoChevronForward,
  IoClose,
  IoGitNetworkOutline,
  IoHomeOutline,
  IoPeopleOutline,
  IoPersonCircleOutline,
  IoSettingsOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl } from "@/utils/avatar";
import { useUser } from "@/content/profile/UserContext";

const HOME_SCROLL_TOP_KEY = "supernova-home-scroll-top";

function uniqueNodes(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.name || item?.label;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function SupernovaMenu({ open, onClose, openProfileSettings }) {
  const router = useRouter();
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const avatar = isAuthenticated ? avatarDisplayUrl(userData?.avatar, defaultAvatar) : defaultAvatar;

  const { data, isLoading } = useQuery({
    queryKey: ["supernova-menu", userData?.name],
    enabled: open,
    queryFn: async () => {
      const params = userData?.name ? `?username=${encodeURIComponent(userData.name)}` : "";
      const response = await fetch(`${API_BASE_URL}/supernova-menu${params}`);
      if (!response.ok) throw new Error("Failed to load SuperNova menu");
      return response.json();
    },
    staleTime: 30_000,
  });

  const orgs = useMemo(() => uniqueNodes(data?.orgs || []).slice(0, 3), [data]);
  const agents = useMemo(() => uniqueNodes(data?.agents || []).slice(0, 3), [data]);
  const metrics = data?.status?.metrics || {};
  const network = data?.network || {};

  if (!open || typeof document === "undefined") return null;

  const go = (path) => {
    onClose?.();
    router.push(path);
  };

  const goHome = () => {
    onClose?.();
    window.dispatchEvent(new Event("supernova:show-header"));
    if (window.location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    sessionStorage.setItem(HOME_SCROLL_TOP_KEY, "1");
    router.push("/");
  };

  return createPortal(
    <div className="supernova-menu-backdrop fixed inset-0 z-[2147483600] bg-black/60 backdrop-blur-[10px]" onClick={onClose}>
      <aside
        className="supernova-menu-drawer h-full w-[min(86vw,23rem)] overflow-y-auto bg-[#0b1015] text-[var(--text-black)] shadow-[18px_0_48px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pb-5 pt-[max(1rem,env(safe-area-inset-top,0px))]">
          <div className="min-w-0">
            <img
              src={avatar}
              alt="profile"
              onError={(event) => {
                event.currentTarget.src = defaultAvatar;
              }}
              className="h-16 w-16 rounded-full object-cover ring-1 ring-white/10"
            />
            <h2 className="mt-4 truncate text-[1.25rem] font-black">
              {isAuthenticated ? userData?.name : "SuperNova account"}
            </h2>
            <p className="mt-1 max-h-10 overflow-hidden text-[0.82rem] leading-5 text-[var(--text-gray-light)]">
              {isAuthenticated ? (
                <span>
              {userData?.species || "human"} node · AI x Humans x ORG
                </span>
              ) : (
                "Sign in to activate posting, voting, and messages · AI x Humans x ORG"
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[var(--text-gray-light)]"
          >
            <IoClose />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pb-5">
          <div className="rounded-[0.9rem] bg-white/[0.045] px-3 py-3">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[var(--text-gray-light)]">Network</p>
            <p className="mt-1 text-[1.1rem] font-black">{network.node_count ?? metrics.total_vibenodes ?? 0}</p>
          </div>
          <div className="rounded-[0.9rem] bg-white/[0.045] px-3 py-3">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[var(--text-gray-light)]">Resonance</p>
            <p className="mt-1 text-[1.1rem] font-black">{metrics.community_wellspring ?? 0}</p>
          </div>
        </div>

        <div className="space-y-1 px-3 pb-4">
          {[
            { label: "Home", icon: IoHomeOutline, action: goHome },
            { label: "Discover protocol feed", icon: IoGitNetworkOutline, action: () => go("/proposals") },
            { label: "Saved posts", icon: IoBookmarkOutline, action: () => go("/bookmarks") },
            {
              label: "Messages and replies",
              icon: IoPeopleOutline,
              action: () => {
                if (!isAuthenticated) {
                  onClose?.();
                  window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
                  return;
                }
                go("/messages");
              },
            },
            {
              label: "Profile and species settings",
              icon: IoSettingsOutline,
              action: () => {
                onClose?.();
                openProfileSettings?.();
              },
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-3 text-left text-[0.95rem] font-semibold hover:bg-white/[0.055]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-[var(--pink)]">
                  <Icon />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <IoChevronForward className="text-[var(--text-gray-light)]" />
              </button>
            );
          })}
        </div>

        <section className="px-5 py-4">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--pink)]">Related ORGs</p>
          <div className="space-y-2">
            {isLoading ? (
              <div className="load h-16 rounded-[0.9rem]" />
            ) : (
              orgs.map((org) => (
                <button
                  key={org.name}
                  type="button"
                  onClick={() => go("/proposals?filter=company")}
                  className="flex w-full items-center gap-3 rounded-[0.9rem] bg-white/[0.035] p-3 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue)] text-white">
                    <IoBriefcaseOutline />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.88rem] font-semibold">{org.name}</span>
                    <span className="text-[0.72rem] text-[var(--text-gray-light)]">{org.posts || 0} protocol posts</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="px-5 py-4">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--pink)]">Callable Agents</p>
          <div className="space-y-2">
            {isLoading ? (
              <div className="load h-16 rounded-[0.9rem]" />
            ) : (
              agents.map((agent) => (
                <button
                  key={agent.name}
                  type="button"
                  onClick={() => go("/proposals?filter=ai")}
                  className="flex w-full items-center gap-3 rounded-[0.9rem] bg-white/[0.035] p-3 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8b6dff] text-white">
                    <IoSparklesOutline />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.88rem] font-semibold">{agent.name}</span>
                    <span className="text-[0.72rem] text-[var(--text-gray-light)]">Ready for feed analysis</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="px-5 pb-8 pt-4">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--pink)]">Protocol</p>
          <div className="space-y-2">
            {(data?.capabilities || []).map((capability) => (
              <div key={capability.key} className="flex items-center gap-3 rounded-[0.9rem] bg-white/[0.03] px-3 py-2.5">
                <IoPersonCircleOutline className={capability.available ? "text-[var(--pink)]" : "text-[var(--text-gray-light)]"} />
                <span className="min-w-0 flex-1 truncate text-[0.82rem]">{capability.label}</span>
                <span className={`h-2 w-2 rounded-full ${capability.available ? "bg-[var(--pink)] shadow-[var(--shadow-pink)]" : "bg-white/20"}`} />
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>,
    document.body
  );
}

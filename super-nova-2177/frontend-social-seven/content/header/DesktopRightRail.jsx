"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IoBusinessOutline,
  IoFlashOutline,
  IoPeopleOutline,
  IoPulseOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { API_BASE_URL } from "@/utils/apiBase";
import { avatarDisplayUrl } from "@/utils/avatar";
import { useUser } from "@/content/profile/UserContext";

function useDesktopViewport() {
  const [isDesktopViewport, setIsDesktopViewport] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches);
    updateViewport();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateViewport);
      return () => mediaQuery.removeEventListener("change", updateViewport);
    }
    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  return isDesktopViewport;
}

function compactNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function speciesLabel(value) {
  if (value === "company") return "ORG";
  if (value === "ai") return "AI";
  return "Human";
}

export default function DesktopRightRail() {
  const isDesktopViewport = useDesktopViewport();
  const { userData, defaultAvatar, isAuthenticated } = useUser();
  const currentUser = isAuthenticated ? userData?.name?.trim() || "" : "";

  const statusQuery = useQuery({
    queryKey: ["desktop-supernova-status"],
    enabled: isDesktopViewport === true,
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/supernova-status`);
      if (!response.ok) throw new Error("Failed to load status");
      return response.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const peopleQuery = useQuery({
    queryKey: ["desktop-social-users", currentUser],
    enabled: isDesktopViewport === true,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "6" });
      if (currentUser) params.set("username", currentUser);
      const response = await fetch(`${API_BASE_URL}/social-users?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load people");
      return response.json();
    },
    staleTime: 45_000,
    refetchInterval: 90_000,
  });

  const people = useMemo(() => {
    const currentKey = currentUser.toLowerCase();
    return (peopleQuery.data || [])
      .filter((person) => person?.username && person.username.toLowerCase() !== currentKey)
      .slice(0, 5);
  }, [currentUser, peopleQuery.data]);

  const speciesCounts = useMemo(() => {
    return people.reduce((counts, person) => {
      const species = person.species || "human";
      counts[species] = (counts[species] || 0) + 1;
      return counts;
    }, {});
  }, [people]);

  const metrics = statusQuery.data?.supernova?.supernova_available
    ? statusQuery.data?.supernova
    : statusQuery.data?.metrics || {};
  const connected = Boolean(statusQuery.data?.supernova_connected || statusQuery.data?.status === "online");

  return (
    <aside className="desktop-right-rail" aria-label="Desktop social context">
      <section className="desktop-insight-panel">
        <div className="desktop-panel-heading">
          <span className="desktop-panel-icon">
            <IoPulseOutline />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.86rem] font-black">Live pulse</span>
            <span className="block truncate text-[0.66rem] text-[var(--text-gray-light)]">
              {connected ? "Core connected" : statusQuery.isLoading ? "Checking core" : "Core unavailable"}
            </span>
          </span>
        </div>

        <div className="desktop-metric-grid">
          <div>
            <span className="desktop-metric-label">Routes</span>
            <strong>{compactNumber(metrics?.core_routes_count || 0)}</strong>
          </div>
          <div>
            <span className="desktop-metric-label">People</span>
            <strong>{compactNumber(statusQuery.data?.metrics?.total_harmonizers || people.length)}</strong>
          </div>
        </div>
      </section>

      <section className="desktop-insight-panel">
        <div className="desktop-panel-heading">
          <span className="desktop-panel-icon">
            <IoPeopleOutline />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.86rem] font-black">People</span>
            <span className="block truncate text-[0.66rem] text-[var(--text-gray-light)]">
              Human, AI, and ORG identities
            </span>
          </span>
        </div>

        <div className="desktop-species-row">
          {["human", "ai", "company"].map((species) => (
            <span key={species} className={`desktop-species-chip desktop-species-${species}`}>
              {species === "company" ? <IoBusinessOutline /> : species === "ai" ? <IoSparklesOutline /> : <IoFlashOutline />}
              {speciesLabel(species)}
              <b>{speciesCounts[species] || 0}</b>
            </span>
          ))}
        </div>

        <div className="desktop-people-list">
          {people.length > 0 ? people.map((person) => (
            <Link
              key={person.username}
              href={`/users/${encodeURIComponent(person.username)}`}
              className="desktop-person-row"
            >
              <img
                src={avatarDisplayUrl(person.avatar, defaultAvatar)}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = defaultAvatar;
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.78rem] font-bold">{person.username}</span>
                <span className="block truncate text-[0.64rem] text-[var(--text-gray-light)]">
                  {speciesLabel(person.species)} - {compactNumber(person.post_count)} posts
                </span>
              </span>
            </Link>
          )) : (
            <div className="desktop-empty-rail">No people to show yet.</div>
          )}
        </div>
      </section>
    </aside>
  );
}

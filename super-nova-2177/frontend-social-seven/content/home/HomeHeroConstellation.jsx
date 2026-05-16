"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IoArrowForward, IoPlanetOutline, IoSparklesOutline } from "react-icons/io5";
import { API_BASE_URL } from "@/utils/apiBase";
import { useUser } from "@/content/profile/UserContext";

const HeroSocialConstellation = dynamic(
  () => import("@/content/header/DesktopRightRail").then((module) => module.SocialConstellation),
  {
    ssr: false,
    loading: () => (
      <div className="home-hero-constellation-state">
        <IoPlanetOutline />
        <span>Mapping the constellation...</span>
      </div>
    ),
  }
);

export default function HomeHeroConstellation({ onCreateSignal }) {
  const { userData, isAuthenticated } = useUser();
  const currentUser = isAuthenticated ? userData?.name?.trim() || "" : "";
  const [enableGraph, setEnableGraph] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setEnableGraph(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const graphQuery = useQuery({
    queryKey: ["home-hero-social-graph", currentUser],
    enabled: enableGraph,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "24" });
      if (currentUser) params.set("username", currentUser);
      const response = await fetch(`${API_BASE_URL}/social-graph?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load constellation");
      return response.json();
    },
    staleTime: 45_000,
    refetchInterval: 120_000,
  });

  return (
    <section className="home-hero-constellation mobile-feed-panel social-panel" aria-label="SuperNova living network">
      <div className="home-hero-copy">
        <span className="home-hero-kicker">
          <IoSparklesOutline />
          SuperNova 2177
        </span>
        <h1>A living network where humans, AI, and organizations decide together.</h1>
        <p>
          Share signals, review decisions, vote on outcomes, and watch the constellation form around real participation.
        </p>
        <div className="home-hero-actions" aria-label="Hero actions">
          <button type="button" onClick={onCreateSignal} className="home-hero-primary">
            Create signal
            <IoArrowForward />
          </button>
          <Link href="/proposals" className="home-hero-secondary">
            Explore decisions
          </Link>
          <Link href="/universe" className="home-hero-secondary">
            Open constellation
          </Link>
        </div>
      </div>

      <div className="home-hero-graph" aria-label="Live constellation preview">
        {!enableGraph || graphQuery.isLoading ? (
          <div className="home-hero-constellation-state">
            <IoPlanetOutline />
            <span>Mapping the constellation...</span>
          </div>
        ) : graphQuery.isError ? (
          <div className="home-hero-constellation-state">
            <IoPlanetOutline />
            <span>Constellation is warming up.</span>
          </div>
        ) : (
          <HeroSocialConstellation graph={graphQuery.data} currentUser={currentUser} variant="hero" />
        )}
      </div>
    </section>
  );
}

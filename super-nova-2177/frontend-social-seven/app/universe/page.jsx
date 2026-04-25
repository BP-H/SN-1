"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IoArrowBack,
  IoRefreshOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { API_BASE_URL } from "@/utils/apiBase";
import { useUser } from "@/content/profile/UserContext";
import { SocialConstellation } from "@/content/header/DesktopRightRail";
import AmbientConstellationCanvas from "@/content/universe/AmbientConstellationCanvas";

function compactNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

export default function UniversePage() {
  const { userData, isAuthenticated } = useUser();
  const currentUser = isAuthenticated ? userData?.name?.trim() || "" : "";

  const graphQuery = useQuery({
    queryKey: ["universe-social-graph", currentUser],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "72" });
      if (currentUser) params.set("username", currentUser);
      const response = await fetch(`${API_BASE_URL}/social-graph?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load universe");
      return response.json();
    },
    staleTime: 30_000,
    refetchInterval: 90_000,
  });

  const nodes = graphQuery.data?.nodes || [];
  const edges = graphQuery.data?.edges || [];

  return (
    <section className="universe-page" aria-label="SuperNova universe">
      <div className="universe-ambient" aria-hidden="true" />
      <div className="universe-shell">
        <header className="universe-header">
          <Link href="/" className="universe-icon-button" aria-label="Back home" title="Back home">
            <IoArrowBack />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="universe-kicker">SuperNova</p>
            <h1>Live Universe</h1>
          </div>
          <button
            type="button"
            onClick={() => graphQuery.refetch()}
            className="universe-icon-button"
            aria-label="Refresh universe"
            title="Refresh universe"
          >
            <IoRefreshOutline />
          </button>
        </header>

        <div className="universe-grid">
          <div className="universe-graph-card">
            <AmbientConstellationCanvas className="universe-canvas" density={28} frameMs={58} />
            {graphQuery.isLoading ? (
              <div className="universe-loading">
                <span className="loading-spinner-glyph h-14 w-14" role="img" aria-label="Loading" />
              </div>
            ) : (
              <SocialConstellation graph={graphQuery.data} currentUser={currentUser} variant="immersive" />
            )}
          </div>

          <aside className="universe-stats-card">
            <div className="universe-stat-glow">
              <IoSparklesOutline />
            </div>
            <p className="universe-kicker">Resonance</p>
            <strong>{compactNumber(edges.length)}</strong>
            <span>active links</span>
            <div className="universe-stat-row">
              <span>Nodes</span>
              <b>{compactNumber(nodes.length)}</b>
            </div>
            <div className="universe-stat-row">
              <span>Current</span>
              <b>{currentUser || "Guest"}</b>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

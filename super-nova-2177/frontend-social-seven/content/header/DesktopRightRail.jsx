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
import { useUser } from "@/content/profile/UserContext";

const SPECIES_LABELS = {
  human: "Human",
  ai: "AI",
  company: "ORG",
};

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
  return SPECIES_LABELS[value] || "Human";
}

function initials(username = "") {
  return username.trim().slice(0, 2).toUpperCase() || "SN";
}

function nodePosition(node, index, count) {
  if (node.is_current) {
    return { x: 140, y: 104, depth: 1 };
  }
  const safeCount = Math.max(1, count);
  const angle = index * 2.399963229728653 + 0.28;
  const ring = 62 + (index % 3) * 17 + Math.min(18, safeCount * 0.8);
  const wobble = Math.sin(index * 1.7) * 10;
  return {
    x: 140 + Math.cos(angle) * (ring + wobble),
    y: 104 + Math.sin(angle) * (ring * 0.68 + wobble * 0.3),
    depth: 0.54 + ((index % 5) * 0.1),
  };
}

function reasonSummary(reasons = {}) {
  return Object.entries(reasons)
    .filter(([, value]) => Number(value) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 3)
    .map(([key, value]) => `${key} ${value}`)
    .join(" / ");
}

function SocialConstellation({ graph, currentUser }) {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");

  const layout = useMemo(() => {
    const positioned = nodes.map((node, index) => {
      const position = nodePosition(node, index, nodes.length);
      const score = Number(node.activity_score || 0);
      return {
        ...node,
        ...position,
        radius: Math.max(7, Math.min(17, 7 + Math.sqrt(score + 1) * 1.9)),
      };
    });
    const byId = new Map(positioned.map((node) => [node.id, node]));
    const renderedEdges = edges
      .map((edge) => ({ ...edge, sourceNode: byId.get(edge.source), targetNode: byId.get(edge.target) }))
      .filter((edge) => edge.sourceNode && edge.targetNode);
    return { nodes: positioned, edges: renderedEdges };
  }, [edges, nodes]);

  useEffect(() => {
    if (!selectedNodeId && layout.nodes.length) {
      const current = layout.nodes.find((node) => node.is_current);
      setSelectedNodeId((current || layout.nodes[0]).id);
    }
  }, [layout.nodes, selectedNodeId]);

  const selectedNode = layout.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = layout.edges.find((edge) => edge.id === selectedEdgeId);
  const selectedSource = selectedEdge?.sourceNode;
  const selectedTarget = selectedEdge?.targetNode;
  const speciesCounts = useMemo(() => {
    return nodes.reduce((counts, node) => {
      const species = node.species || "human";
      counts[species] = (counts[species] || 0) + 1;
      return counts;
    }, {});
  }, [nodes]);

  if (!nodes.length) {
    return <div className="desktop-empty-rail">Constellation wakes up after people post, follow, vote, or comment.</div>;
  }

  return (
    <div className="desktop-constellation">
      <div className="desktop-constellation-stage" aria-label="Live social constellation">
        <svg viewBox="0 0 280 210" role="img" className="desktop-constellation-svg">
          <defs>
            <radialGradient id="constellation-core" cx="42%" cy="38%" r="65%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="52%" stopColor="currentColor" stopOpacity="0.82" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
            </radialGradient>
            <filter id="constellation-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle className="desktop-constellation-depth" cx="140" cy="104" r="76" />
          <circle className="desktop-constellation-depth desktop-constellation-depth-wide" cx="140" cy="104" r="108" />

          {layout.edges.map((edge) => {
            const active = selectedEdgeId === edge.id;
            const width = Math.max(0.7, Math.min(4.2, 0.75 + Number(edge.strength || 0) / 11));
            return (
              <g key={edge.id}>
                <line
                  x1={edge.sourceNode.x}
                  y1={edge.sourceNode.y}
                  x2={edge.targetNode.x}
                  y2={edge.targetNode.y}
                  className={`desktop-constellation-edge ${active ? "is-active" : ""}`}
                  strokeWidth={width}
                />
                <line
                  x1={edge.sourceNode.x}
                  y1={edge.sourceNode.y}
                  x2={edge.targetNode.x}
                  y2={edge.targetNode.y}
                  className="desktop-constellation-edge-hit"
                  onMouseEnter={() => {
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId("");
                  }}
                  onClick={() => {
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId("");
                  }}
                />
              </g>
            );
          })}

          {layout.nodes.map((node, index) => {
            const selected = selectedNodeId === node.id;
            const current = node.is_current || (currentUser && node.id === currentUser.toLowerCase());
            return (
              <g
                key={node.id}
                className={`desktop-constellation-node desktop-node-${node.species || "human"} ${selected ? "is-selected" : ""} ${current ? "is-current" : ""}`}
                style={{ "--float-delay": `${(index % 6) * -0.45}s`, "--node-depth": node.depth }}
                transform={`translate(${node.x} ${node.y})`}
                onMouseEnter={() => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId("");
                }}
                onClick={() => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId("");
                }}
              >
                <circle className="desktop-node-aura" r={node.radius + 8} />
                <circle className="desktop-node-ring" r={node.radius + 3} />
                <circle className="desktop-node-core" r={node.radius} filter="url(#constellation-glow)" />
                <text className="desktop-node-label" textAnchor="middle" dy="0.32em">
                  {initials(node.username)}
                </text>
              </g>
            );
          })}
        </svg>
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

      <div className="desktop-constellation-detail">
        {selectedEdge && selectedSource && selectedTarget ? (
          <>
            <span className="desktop-detail-kicker">Connection</span>
            <strong>{selectedSource.username} + {selectedTarget.username}</strong>
            <span>{reasonSummary(selectedEdge.reasons) || "shared activity"} / strength {compactNumber(selectedEdge.strength)}</span>
          </>
        ) : selectedNode ? (
          <>
            <span className="desktop-detail-kicker">{selectedNode.is_current ? "You" : speciesLabel(selectedNode.species)}</span>
            <strong>{selectedNode.username}</strong>
            <span>{compactNumber(selectedNode.activity_score)} resonance / {compactNumber(edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length)} links</span>
            <Link href={`/users/${encodeURIComponent(selectedNode.username)}`} className="desktop-detail-link">
              Open profile
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function DesktopRightRail() {
  const isDesktopViewport = useDesktopViewport();
  const { userData, isAuthenticated } = useUser();
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

  const graphQuery = useQuery({
    queryKey: ["desktop-social-graph", currentUser],
    enabled: isDesktopViewport === true,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "14" });
      if (currentUser) params.set("username", currentUser);
      const response = await fetch(`${API_BASE_URL}/social-graph?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load constellation");
      return response.json();
    },
    staleTime: 45_000,
    refetchInterval: 90_000,
  });

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
            <span className="desktop-metric-label">Links</span>
            <strong>{compactNumber(graphQuery.data?.meta?.edge_count || 0)}</strong>
          </div>
        </div>
      </section>

      <section className="desktop-insight-panel desktop-constellation-panel">
        <div className="desktop-panel-heading">
          <span className="desktop-panel-icon">
            <IoPeopleOutline />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.86rem] font-black">Live Constellation</span>
            <span className="block truncate text-[0.66rem] text-[var(--text-gray-light)]">
              Human, AI, and ORG resonance
            </span>
          </span>
        </div>

        {graphQuery.isLoading ? (
          <div className="desktop-empty-rail">Mapping the constellation...</div>
        ) : (
          <SocialConstellation graph={graphQuery.data} currentUser={currentUser} />
        )}
      </section>
    </aside>
  );
}

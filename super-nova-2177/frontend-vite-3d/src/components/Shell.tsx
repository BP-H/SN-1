// src/components/Shell.tsx
import React, { useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Feed from "./feed/Feed";
import Sidebar from "./Sidebar";
import ChatDock from "./ChatDock";
import AssistantOrb from "./AssistantOrb";
import AvatarPortal from "./AvatarPortal";
import PortalOverlay from "./PortalOverlay";
import NeonRibbonComposer from "./NeonRibbonComposer";
import { CosmicChat } from "./CosmicChat";
import { Governance } from "./Governance";
import { NetworkGraph } from "./NetworkGraph";
import { api } from "../services/api";
import { GraphData } from "../types";
import { CreatePostModal } from "./CreatePostModal";
import { Plus } from "lucide-react";
import useLocal from "../hooks/useLocal";
import World3D from "./World3D";
import ThirteenthFloorWorld from "../three/ThirteenthFloorWorld";
import BackgroundVoid from "../three/BackgroundVoid";

import { SettingsModal } from "./SettingsModal";
import bus from "../lib/bus";

export default function Shell() {
  const [worldMode] = useLocal<"orbs" | "void" | "floor">("sn.world.mode", "orbs");
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    edges: [],
    metrics: { node_count: 0, edge_count: 0, density: 0 }
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  React.useEffect(() => {
    api.getNetworkAnalysis().then(setGraphData).catch(console.error);

    const openSettings = () => setIsSettingsOpen(true);
    const unsub = bus.on("settings:open", openSettings);
    return () => { unsub(); };
  }, []);

  const world = useMemo(() => {
    return worldMode === "floor" ? (
      <ThirteenthFloorWorld />
    ) : worldMode === "void" ? (
      <BackgroundVoid />
    ) : (
      <World3D />
    );
  }, [worldMode]);

  return (
    <>
      {/* 3D world behind everything */}
      <div className="world-layer" aria-hidden>
        {world}
      </div>
      {/* MenuOrb removed as we now have a persistent sidebar */}
      <Sidebar />
      <PortalOverlay />
      <CreatePostModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <main className="md:pl-20 transition-all duration-500 h-screen overflow-y-auto scrollbar-hide">
        <NeonRibbonComposer />
        <div className="min-h-full pb-24">
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/chat" element={<div className="pt-20 px-4"><CosmicChat /></div>} />
            <Route path="/gov" element={<div className="pt-20 px-4"><Governance /></div>} />
            <Route path="/graph" element={<div className="pt-20 px-4 glass-panel m-4 rounded-xl"><h2 className="text-white font-bold mb-4">Network Graph</h2><NetworkGraph data={graphData} /></div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Floating Action Button for Post Creation */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-nova-cyan to-nova-purple text-white shadow-[0_0_20px_rgba(124,131,255,0.5)] flex items-center justify-center hover:scale-110 transition-transform hover:shadow-[0_0_30px_rgba(124,131,255,0.8)]"
        title="Create Post"
      >
        <Plus size={28} />
      </button>

      <ChatDock />
      <AssistantOrb />
      <AvatarPortal />
    </>
  );
}

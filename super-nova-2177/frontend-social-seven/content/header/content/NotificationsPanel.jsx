"use client";

import { useQuery } from "@tanstack/react-query";
import { IoEllipse } from "react-icons/io5";
import LiquidGlass from "@/content/liquid glass/LiquidGlass";
import { API_BASE_URL } from "@/utils/apiBase";

function formatRelativeTime(dateString) {
  if (!dateString) return "now";
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "now";
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return "now";
}

export default function NotificationsPanel() {
  const { data } = useQuery({
    queryKey: ["header-notifications"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/proposals?filter=latest`);
      if (!response.ok) throw new Error("Failed to fetch activity");
      return response.json();
    },
    staleTime: 30_000,
  });

  const items = (data || []).slice(0, 3).map((post) => ({
    id: post.id,
    title: post.title || "New proposal",
    time: formatRelativeTime(post.time),
  }));

  return (
    <LiquidGlass className="w-full rounded-[1.3rem] p-3">
      <div className="flex w-full flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-[0.84rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-gray-light)]">
            Recent Activity
          </h3>
          <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--pink)]">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-[1rem] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-[0.82rem] text-[var(--text-gray-light)]">
            No new notifications yet.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-[1rem] bg-[rgba(255,255,255,0.04)] px-4 py-3"
            >
              <div className="mb-1 flex items-center gap-2 text-[0.72rem] text-[var(--text-gray-light)]">
                <IoEllipse className="text-[0.55rem] text-[var(--pink)]" />
                <span>New community post</span>
                <span>·</span>
                <span>{item.time}</span>
              </div>
              <p className="line-clamp-2 text-[0.84rem] font-medium text-[var(--text-black)]">
                {item.title}
              </p>
            </div>
          ))
        )}
      </div>
    </LiquidGlass>
  );
}

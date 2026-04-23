// src/components/feed/Feed.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import PostCard from "./PostCard";
import bus from "../../lib/bus";
import { useFeedStore } from "../../lib/feedStore";
import "./Feed.css";
import { api } from "../../services/api";
import { Post } from "../../types";

const PAGE = 9;
const PRELOAD_PX = 800;

interface FeedProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function Feed({ children, style }: FeedProps) {
  const posts = useFeedStore((s) => s.posts);
  const setPosts = useFeedStore((s) => s.setPosts);
  const [limit, setLimit] = useState(PAGE);
  const limitRef = useRef(limit);
  const visible = useMemo(() => posts.slice(0, limit), [posts, limit]);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const vibeNodes = await api.getVibeNodes();
        const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
        const mappedPosts: Post[] = vibeNodes.map(v => {
          const isProposal = true; // Since getVibeNodes fetches proposals
          // Fix media URL
          let mediaUrl = v.media_url;
          if (mediaUrl && !mediaUrl.startsWith('http') && !mediaUrl.startsWith('blob:')) {
            // Ensure slash
            const cleanPath = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
            mediaUrl = `${API_URL}${cleanPath}`;
          }

          return {
            id: String(v.id),
            author: v.author_username,
            authorAvatar: undefined, // Backend doesn't provide avatar yet
            title: v.name,
            time: new Date(v.created_at).toLocaleDateString(),
            location: 'superNova',
            image: v.media_type === 'image' ? mediaUrl : undefined,
            video: v.media_type === 'video' ? mediaUrl : undefined,
            isProposal: isProposal,
            votes_summary: (v as any).votes_summary, // Cast to access proposal fields if they exist on VibeNode type or extend VibeNode
            comments: (v as any).comments,
            likes_count: v.likes_count,
            comments_count: v.comments_count
          };
        });

        // Merge with existing posts or replace? 
        // For now, let's just add them if they are not there, or replace demo posts.
        // But useFeedStore initializes with demoPosts.
        // Let's prepend real posts.
        if (mappedPosts.length > 0) {
          setPosts(mappedPosts);
        }
      } catch (e) {
        console.error("Failed to fetch feed", e);
      }
    };
    fetchPosts();
  }, [setPosts]);

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

  // infinite scroll
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const near = el.scrollTop + el.clientHeight > el.scrollHeight - PRELOAD_PX;
      if (near && limitRef.current < posts.length) setLimit((n) => n + PAGE);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [posts.length]);

  // feed:hover (nearest post around viewport mid) — only if we have posts
  useEffect(() => {
    if (!posts.length) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const cards = Array.from(el.querySelectorAll<HTMLElement>(".pc"));
      const cy = window.innerHeight * 0.45;
      let best: { node: HTMLElement; d: number } | null = null;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        const mid = (r.top + r.bottom) / 2;
        const d = Math.abs(mid - cy);
        if (!best || d < best.d) best = { node: c, d };
      }
      if (best) {
        const id = best.node.dataset.postId!;
        const p = posts.find((pp) => String(pp.id) === id);
        if (p) bus.emit("feed:hover", { post: p, rect: best.node.getBoundingClientRect() });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [posts]);

  return (
    <div ref={ref} className="content-viewport" style={style}>
      <div className="feed-wrap">
        <div className="feed-content">
          {children}
          {visible.length ? (
            visible.map((p) => <PostCard key={String(p.id)} post={p} />)
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "60vh",
        color: "var(--ink, #eef2ff)",
        opacity: 0.9,
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>No posts yet</div>
        <div style={{ opacity: 0.8 }}>
          Use the orb to <code>/world</code>, <code>/comment</code>, <code>/react ❤️</code>, or connect your backend and inject
          <br />
          <code>window.__SN_POSTS__ = [/* your posts */]</code>
        </div>
      </div>
    </div>
  );
}


// src/components/Feed2D.tsx
import { useMemo, useRef } from "react";
import "./Feed2D.css";

type XY = { x: number; y: number };
type Props = { onEnterWorld: (p: any, at: XY) => void };

// Minimal demo data (replace with your real posts if you want)
const DEMO = [
  {
    id: "1",
    handle: "@forest_bot",
    tags: "#superNova",
    title: "Low‑poly tree",
    time: "1h",
    img: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "2",
    handle: "@proto_ai",
    tags: "#superNova",
    title: "Ocean study",
    time: "2h",
    img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop",
  },
];

export default function Feed2D({ onEnterWorld }: Props) {
  const posts = useMemo(() => DEMO, []);
  return (
    <main className="nv-feed">
      {posts.map((p) => (
        <FeedCard key={p.id} post={p} onEnterWorld={onEnterWorld} />
      ))}
      <div className="nv-bottom-spacer" />
    </main>
  );
}

function FeedCard({ post, onEnterWorld }: { post: any; onEnterWorld: (p: any, at: XY) => void }) {
  const centerBtnRef = useRef<HTMLButtonElement>(null);

  const enterWorld = () => {
    const r = centerBtnRef.current?.getBoundingClientRect();
    const at: XY = r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : { x: 0, y: 0 };
    onEnterWorld(post, at);
  };

  return (
    <article className="nv-card" role="article" aria-label={post.title}>
      <div className="nv-media">
        <img
          src={post.img}
          alt={post.title}
          width={800}
          height={1000}
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* Glass plaque (top, centered) */}
      <div className="nv-plaque">
        <div className="nv-dot" aria-hidden="true"></div>
        <div className="nv-plaque-meta">
          <div className="nv-handle">{post.handle}</div>
          <div className="nv-sub">
            <span>{post.time}</span> · <span className="nv-tag">{post.tags}</span>
          </div>
          <div className="nv-title">{post.title}</div>
        </div>
      </div>

      {/* Bottom actions (5 icons) */}
      <div className="nv-actions" role="toolbar" aria-label="Post actions">
        <button className="nv-act" aria-label="Like">
          {iconHeart}
        </button>
        <button className="nv-act" aria-label="Comment">
          {iconChat}
        </button>
        <button className="nv-act nv-act-primary" onClick={enterWorld} aria-label="Enter world" ref={centerBtnRef}>
          {iconSpark}
        </button>
        <button className="nv-act" aria-label="Save">
          {iconBookmark}
        </button>
        <button className="nv-act" aria-label="Share">
          {iconShare}
        </button>
      </div>
    </article>
  );
}

/* --- tiny inline SVGs --- */
const iconHeart = (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21s-7-4.35-9.33-8.17C.77 9.9 2.3 6 6.05 6c2.03 0 3.39 1.13 3.95 2.1C10.61 7.13 11.97 6 14 6c3.75 0 5.28 3.9 3.38 6.83C19 16.65 12 21 12 21z" fill="currentColor"/>
  </svg>
);
const iconChat = (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 4H4a2 2 0 0 0-2 2v9.5A2.5 2.5 0 0 0 4.5 18H7v3l4-3h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" fill="currentColor"/>
  </svg>
);
const iconSpark = (
  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" fill="currentColor"/>
  </svg>
);
const iconBookmark = (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-3-7 3V5a1 1 0 0 1 1-1z" fill="currentColor"/>
  </svg>
);
const iconShare = (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18 8a3 3 0 1 0-2.83-4H9a1 1 0 0 0 0 2h6.17A3 3 0 0 0 18 8zM6 16a3 3 0 1 0 2.83 4H15a1 1 0 0 0 0-2H8.83A3 3 0 0 0 6 16zm12-6H6a1 1 0 0 0 0 2h12a1 1 0 0 0 0-2z" fill="currentColor"/>
  </svg>
);
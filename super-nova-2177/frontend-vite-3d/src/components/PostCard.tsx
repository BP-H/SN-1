// src/components/PostCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./postcard.css";
import type { Post } from "../types";
import bus from "../lib/bus";
import { ensureModelViewer } from "../lib/ensureModelViewer";
import AmbientWorld from "./AmbientWorld";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

const isBlob = (u?: string | null) => !!u && u.startsWith("blob:");

const EMOJI_LIST: string[] = [
  "🤗", "😂", "🤣", "😅", "🙂", "😉", "😍", "😎", "🥳", "🤯", "😡", "😱", "🤔", "🤭", "🙄", "🥺", "🤪", "🤫", "🤤", "😴",
  "👻", "🤖", "👽", "😈", "👋", "👍", "👎", "👏", "🙏", "👀", "💪", "🫶", "💅", "🔥", "✨", "⚡", "💥", "❤️", "🫠", "🫡",
  "💙", "💜", "🖤", "🤍", "❤️‍🔥", "❤️‍🩹", "💯", "💬", "🗯️", "🎉", "🎊", "🎁", "🏆", "🎮", "🚀", "✈️", "🚗", "🏠", "🫨", "🗿",
  "📱", "💡", "🎵", "📢", "📚", "📈", "✅", "❌", "❗", "❓", "‼️", "⚠️", "🌀", "🎬", "🍕", "🍔", "🍎", "🍺", "⚙️", "🧩"
];

export default function PostCard({ post }: { post: Post }) {
  const [drawer, setDrawer] = useState(false);
  const [comments, setComments] = useState<string[]>(post.comments?.map(c => c.comment) || []);
  const [reactions, setReactions] = useState<string[]>([]);
  const { user } = useAuth();

  // Initialize vote counts from summary
  const [upvotes, setUpvotes] = useState(post.votes_summary?.up_human || post.likes_count || 0);
  const [downvotes, setDownvotes] = useState(post.votes_summary?.down_human || 0);
  const [voteState, setVoteState] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    // If we wanted real-time updates, we'd poll or use a socket here.
    // For now, we rely on initial props.
  }, [post.id]);

  const handleVote = async (type: 'up' | 'down') => {
    if (!user) return alert("Please login to vote");
    if (voteState === type) return; // Prevent double voting
    try {
      if (voteState) {
        // If changing vote, ideally we'd remove old vote first, but this is a simplified optimistic update
        if (voteState === 'up') setUpvotes(s => s - 1);
        else setDownvotes(s => s - 1);
      }
      await api.voteProposal(Number(post.id), type, user.species, user.username);
      if (type === 'up') setUpvotes(s => s + 1);
      else setDownvotes(s => s + 1);
      setVoteState(type);
    } catch (e) {
      console.error("Vote failed", e);
    }
  };

  const handleComment = async (text: string) => {
    if (!user) return alert("Please login to comment");
    try {
      await api.addComment(Number(post.id), text, user.species, user.username, '');
      setComments(s => [text, ...s]);
    } catch (e) {
      console.error("Comment failed", e);
    }
  };

  const pdf = (post as any)?.pdf as string | undefined;
  const model3d = (post as any)?.model3d as string | undefined;
  const video = (post as any)?.video as string | undefined;

  useEffect(() => { if (model3d) ensureModelViewer().catch(() => { }); }, [model3d]);

  const images = useMemo(() => {
    const out: string[] = [];
    const srcs =
      post?.images && post.images.length
        ? post.images
        : [post?.image || post?.cover].filter(Boolean);
    for (const img of srcs as any[]) {
      if (!img) continue;
      if (typeof img === "string") out.push(img);
      else if (img.url) out.push(String(img.url));
    }
    return out;
  }, [post, video, pdf, model3d]);

  const onMediaReady = (e: React.SyntheticEvent<any>) => {
    const el = e.currentTarget as any;
    try { el.style.opacity = "1"; } catch { }
    const src: string = el.currentSrc || el.src || el.getAttribute?.("src") || "";
    if (src && src.startsWith("blob:")) { try { URL.revokeObjectURL(src); } catch { } }
  };

  // carousel
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let t = 0;
    const onScroll = () => {
      cancelAnimationFrame(t);
      t = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const i = Math.round(el.scrollLeft / w);
        if (i !== idx) setIdx(i);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [idx]);
  const go = (i: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    el.scrollTo({ left: w * i, behavior: "smooth" });
  };

  const postId = String(post?.id ?? "");

  return (
    <article className={`pc tank ${drawer ? "dopen" : ""}`} data-post-id={postId} id={`post-${postId}`}>
      <div className="pc-tank">
        <div className="pc-topbar" role="group" aria-label="Post info">
          <div className="pc-ava"
            title={post?.author || "@user"}
            onClick={() => bus.emit?.("profile:open", { id: post.author })}
            role="button" aria-label="Open profile">
            <img src={post?.authorAvatar || "/avatar.jpg"} alt={post?.author || "user"} />
          </div>
          <div className="pc-meta">
            <div className="pc-handle">{post?.author || "@user"}</div>
            <div className="pc-sub">{post?.time || "now"} • {post?.location || "superNova"}</div>
          </div>
          {post?.title && <div className="pc-title">{post.title}</div>}
        </div>

        <div className="pc-media-wrap">
          {pdf ? (
            <iframe className="pc-media" src={pdf} title="PDF" onLoad={onMediaReady} />
          ) : model3d ? (
            <model-viewer className="pc-media" src={model3d} camera-controls onLoad={onMediaReady} />
          ) : video ? (
            video.includes('youtube.com') || video.includes('youtu.be') ? (
              <iframe
                className="pc-media aspect-video w-full"
                src={`https://www.youtube.com/embed/${(() => {
                  const match = video.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                  return match ? match[1] : video.split('v=')[1]?.split('&')[0];
                })()}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                className="pc-media"
                src={video}
                controls
                playsInline
                preload="metadata"
                crossOrigin={isBlob(video) ? undefined : "anonymous"}
                onLoadedData={onMediaReady}
              />
            )
          ) : images.length > 1 ? (
            <div ref={wrapRef} className="pc-carousel" role="region" aria-roledescription="carousel" aria-label="Post images">
              {images.map((src, i) => {
                const key = images.indexOf(src) === i ? src : `${src}-${i}`;
                return (
                  <img
                    key={key}
                    src={src}
                    alt={post?.title || post?.author || "post"}
                    loading="lazy"
                    decoding="async"
                    crossOrigin={isBlob(src) ? undefined : "anonymous"}
                    onLoad={onMediaReady}
                  />
                );
              })}
            </div>
          ) : images.length ? (
            <img
              className="pc-media"
              src={images[0]}
              alt={post?.title || post?.author || "post"}
              loading="lazy"
              crossOrigin={isBlob(images[0]) ? undefined : "anonymous"}
              onLoad={onMediaReady}
            />
          ) : (
            <AmbientWorld className="pc-media" />
          )}
        </div>

        <div className="pc-botbar" role="toolbar" aria-label="Post actions">
          <div className="pc-ava"
            title={`View ${post?.author || "@user"}`}
            onClick={() => bus.emit?.("profile:open", { id: post.author })}
            role="button" aria-label="Open profile">
            <img src={post?.authorAvatar || "/avatar.jpg"} alt={post?.author || "user"} />
          </div>
          <div className="pc-actions" aria-label="Actions">
            <button className="pc-act" aria-label="Upvote" title="Upvote" onClick={() => handleVote('up')}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s-7-4.5-9.5-8A5.8 5.8 0 0 1 12 6a5.8 5.8 0 0 1 9.5 7c-2.5 3.5-9.5 8-9.5 8z"
                  fill={upvotes > (post.likes_count || 0) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '0.8em', marginLeft: 4 }}>{upvotes}</span>
            </button>
            <button className="pc-act" aria-label="Downvote" title="Downvote" onClick={() => handleVote('down')}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: 'rotate(180deg)' }}>
                <path d="M12 21s-7-4.5-9.5-8A5.8 5.8 0 0 1 12 6a5.8 5.8 0 0 1 9.5 7c-2.5 3.5-9.5 8-9.5 8z"
                  fill={downvotes > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '0.8em', marginLeft: 4 }}>{downvotes}</span>
            </button>
            <button className="pc-act" aria-label="Comment" title="Comment" onClick={() => setDrawer(true)}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 5v-5H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                  fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '0.8em', marginLeft: 4 }}>{comments.length}</span>
            </button>

            {/* Optimized Reaction Display */}
            <div className="flex items-center gap-1 ml-2 overflow-hidden max-w-[100px]">
              {reactions.slice(0, 3).map((r, i) => (
                <span key={i} className="text-sm animate-bounce-in">{r}</span>
              ))}
              {reactions.length > 3 && <span className="text-xs text-gray-500">+{reactions.length - 3}</span>}
            </div>

            <button className="pc-act ml-auto" aria-label="Share" title="Share"
              onClick={async () => {
                if (typeof location !== "undefined" && typeof navigator !== "undefined" && (navigator as any).clipboard?.writeText) {
                  const url = `${location.origin}${location.pathname}#post-${post.id}`;
                  try { await (navigator as any).clipboard.writeText(url); } catch { }
                }
              }}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 9V5l7 7-7 7v-4H4V9h10Z"
                  fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {images.length > 1 && (
            <div className="pc-dots" aria-hidden="true">
              {images.map((_, i) => (
                <button key={i} className={`pc-dot ${i === idx ? "on" : ""}`} onClick={() => go(i)} aria-label={`Go to image ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pc-drawer">
        <div className="pc-drawer-inner">
          <div className="pc-section">
            <strong>Comments</strong>
            {comments.length ? (
              <ul className="pc-comments">{comments.map((c, i) => <li key={i}>{c}</li>)}</ul>
            ) : (<div className="pc-empty">—</div>)}
            <form className="pc-addcmt" onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("cmt") as HTMLInputElement;
              const t = input.value.trim(); if (!t) return;
              handleComment(t);
              input.value = "";
            }}>
              <input name="cmt" placeholder="Write a comment…" />
              <button type="submit">Send</button>
            </form>
          </div>
        </div>
      </div>
    </article>
  );
}

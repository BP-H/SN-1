import React, { useEffect, useMemo, useRef, useState } from "react";
import "./postcard.css";
import type { Post } from "../../types";
import bus from "../../lib/bus";
import { ensureModelViewer } from "../../lib/ensureModelViewer";
import AmbientWorld from "../AmbientWorld";

const OR = (a: any, b: any) => (a ?? b);

/** keep a tiny constant here so we don’t add new files */
const EMOJI_LIST: string[] = [
  "❤️","👍","🔥","👏","😂","😮","😢","🤯","😍","😎","🥳","🤝","💡","🚀","✨","💯","🫶","🤖","🧠","🎉",
  "🤔","🤗","😆","😡","😱","😴","🙏","👀","💪","⚡"
];

const isBlob = (u?: string | null) => !!u && u.startsWith("blob:");

export default function PostCard({ post }: { post: Post }) {
  const [reactions, setReactions] = useState<string[]>([]);
  const [comments, setComments] = useState<string[]>([]);
  const [reactOpen, setReactOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);
  const [pollOpts, setPollOpts] = useState<{ id: string; text: string; votes: number }[]>(
    () => {
      const p = (post as any)?.poll?.options || [];
      return p.map((o: any, i: number) => ({
        id: String(o.id ?? i),
        text: String(o.text ?? o),
        votes: Number(o.votes) || 0,
      }));
    },
  );
  const [voted, setVoted] = useState<string | null>(null);
  const reactionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reactions) m.set(r, (m.get(r) || 0) + 1);
    return Array.from(m.entries());
  }, [reactions]);
  const cmtRef = useRef<HTMLInputElement | null>(null);

  // bus hooks (unchanged logic)
  useEffect(() => {
    const off1 = bus.on?.("post:react", ({ id, emoji }) => {
      if (String(id) !== String(post.id)) return;
      setReactions((s) => [emoji, ...s].slice(0, 40));
    });
    const off2 = bus.on?.("post:comment", ({ id, body }) => {
      if (String(id) !== String(post.id)) return;
      setComments((s) => [body, ...s]);
    });
    const off3 = bus.on?.("post:vote", ({ id, optionIndex }) => {
      if (String(id) !== String(post.id)) return;
      setPollOpts((opts) =>
        opts.map((o, i) => (i === Number(optionIndex) ? { ...o, votes: o.votes + 1 } : o)),
      );
    });
    return () => {
      try {
        off1?.();
        off2?.();
        off3?.();
      } catch {}
    };
  }, [post.id]);

  useEffect(() => {
    const p = (post as any)?.poll?.options || [];
    setPollOpts(
      p.map((o: any, i: number) => ({
        id: String(o.id ?? i),
        text: String(o.text ?? o),
        votes: Number(o.votes) || 0,
      })),
    );
    setVoted(null);
  }, [post.id]);

  useEffect(() => { if (commentOpen) cmtRef.current?.focus(); }, [commentOpen]);

  // media picking
  const pdf     = (post as any)?.pdf as string | undefined;
  const model3d = (post as any)?.model3d as string | undefined;
  const video   = (post as any)?.video as string | undefined;
  useEffect(() => { if (model3d) ensureModelViewer().catch(() => {}); }, [model3d]);

  // build image list (carousel)
  const images = useMemo(() => {
    const out: string[] = [];
    const srcs =
      post?.images && post.images.length
        ? post.images
        : [OR((post as any)?.image, (post as any)?.cover)].filter(Boolean);
    for (const img of srcs as any[]) {
      if (!img) continue;
      if (typeof img === "string") out.push(img);
      else if (img.url) out.push(String(img.url));
    }
    return out;
  }, [post, video, pdf, model3d]);

  // media load → fade in + revoke blob
  const onMediaReady = (e: React.SyntheticEvent<any>) => {
    const el = e.currentTarget as any;
    try { el.style.opacity = "1"; } catch {}
    const src: string = el.currentSrc || el.src || el.getAttribute?.("src") || "";
    if (src.startsWith("blob:")) try { URL.revokeObjectURL(src); } catch {}
  };

  // share link (preserve old behavior)
  async function copyLink() {
    if (typeof location === "undefined" || typeof navigator === "undefined") return;
    const url = `${location.origin}${location.pathname}#post-${post.id}`;
    try { await navigator.clipboard.writeText(url); } catch {}
  }

  const handleVote = (optId: string, index: number) => {
    if (voted) return;
    setVoted(optId);
    bus.emit?.("post:vote", { id: post.id, optionIndex: index });
  };

  const totalVotes = pollOpts.reduce((sum, o) => sum + o.votes, 0);

  return (
    <article className="pc" data-post-id={String(post.id)} id={`post-${post.id}`}>
      {/* ONE glass frame that contains: header → media → footer */}
      <div className="pc-frame">
        {/* Header (top part of the glass, thicker) */}
        <header className="pc-head">
          <div
            className="pc-ava small"
            onClick={() => bus.emit?.("profile:open", { id: post.author })}
            title={`Open ${post?.author || "profile"}`}
            role="button"
          >
            <img src={post?.authorAvatar || "/avatar.jpg"} alt={post?.author || "user"} />
          </div>
          <div className="pc-meta">
            <div className="pc-handle">{post?.author || "@user"}</div>
            <div className="pc-sub">{post?.time || "now"} · {post?.location || "superNova"}</div>
          </div>
          {post?.title && <div className="pc-title">{post.title}</div>}
        </header>

        {/* Media (black panel) – picture/video/pdf/3d — fully framed by this glass */}
        <div className="pc-media">
          {pdf ? (
            <iframe
              src={pdf}
              title="PDF"
              onLoad={onMediaReady}
              width="100%"
              style={{ opacity: 0, height: "56vw" }}
            />
          ) : model3d ? (
            <model-viewer
              src={model3d}
              camera-controls
              onLoad={onMediaReady}
              style={{ opacity: 0 }}
            />
          ) : video ? (
            <video
              src={video}
              controls
              playsInline
              preload="metadata"
              crossOrigin={isBlob(video) ? undefined : "anonymous"}
              onLoadedData={onMediaReady}
              style={{ opacity: 0 }}
            />
          ) : images.length > 1 ? (
            <div className="pc-carousel" aria-label="Media carousel">
              {images.map((src, i) => (
                <div className="pc-slide" key={`${src}-${i}`}>
                  <img
                    src={src}
                    alt={post?.title || post?.author || "image"}
                    loading="lazy"
                    decoding="async"
                    crossOrigin={isBlob(src) ? undefined : "anonymous"}
                    onLoad={onMediaReady}
                    style={{ opacity: 0 }}
                  />
                </div>
              ))}
            </div>
          ) : images.length ? (
            <img
              src={images[0]}
              alt={post?.title || post?.author || "image"}
              loading="lazy"
              decoding="async"
              crossOrigin={isBlob(images[0]) ? undefined : "anonymous"}
              onLoad={onMediaReady}
              style={{ opacity: 0 }}
            />
          ) : (
            <AmbientWorld />
          )}
        </div>

        {pollOpts.length > 0 && (
          <div className="pc-poll">
            {!voted
              ? pollOpts.map((o, i) => (
                  <button
                    key={o.id}
                    className="pc-poll-option"
                    onClick={() => handleVote(o.id, i)}
                  >
                    {o.text}
                  </button>
                ))
              : pollOpts.map((o) => {
                  const pct = totalVotes
                    ? Math.round((o.votes / totalVotes) * 100)
                    : 0;
                  return (
                    <div
                      key={o.id}
                      className={`pc-poll-result${
                        o.id === voted ? " voted" : ""
                      }`}
                    >
                      <div
                        className="pc-poll-bar"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="pc-poll-label">{o.text}</span>
                      <span className="pc-poll-count">
                        {o.votes} · {pct}%
                      </span>
                    </div>
                  );
                })}
          </div>
        )}

        {/* Footer (bottom of the same glass) */}
        <footer className="pc-foot">
          {/* profile puck on left */}
          <button
            className="pc-ava"
            title="Open profile"
            onClick={() => bus.emit?.("profile:open", { id: post.author })}
          >
            <img src={post?.authorAvatar || "/avatar.jpg"} alt={post?.author || "user"} />
          </button>

          {/* 4 icon actions — thin, line‑weight SVGs; no labels */}
          <div className="pc-actions">
            <button
              className="pc-btn"
              title="React"
              onClick={() => {
                setReactOpen((v) => !v);
                setCommentOpen(false);
                setRemixOpen(false);
              }}
            >
              <svg className="pc-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 21s-7.5-4.5-9.5-8.2A5.9 5.9 0 0 1 12 5.3a5.9 5.9 0 0 1 9.5 7.5C19.5 16.5 12 21 12 21z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {reactions.length > 0 && <span className="pc-count">{reactions.length}</span>}
            </button>
            {reactOpen && (
              <div className="pc-react-strip" role="menu" aria-label="Add reaction">
                {EMOJI_LIST.map((e, i) => (
                  <button
                    key={`${e}-${i}`}
                    className="pc-emo"
                    onClick={() => {
                      bus.emit?.("post:react", { id: post.id, emoji: e });
                      setReactOpen(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <button
              className="pc-btn"
              title="Comment"
              onClick={() => {
                setCommentOpen((v) => !v);
                setReactOpen(false);
                setRemixOpen(false);
              }}
            >
              <svg className="pc-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 5h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 5v-5H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className="pc-btn"
              title="Remix"
              onClick={() => {
                setRemixOpen((v) => !v);
                setReactOpen(false);
                setCommentOpen(false);
              }}
            >
              <svg className="pc-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 4h8l2 3h4v13H5zM8 10h8M8 14h8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="pc-btn" title="Share" onClick={copyLink}>
              <svg className="pc-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M14 9V5l7 7-7 7v-4H5V9h9z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </footer>
      </div>

      {!reactOpen && reactionCounts.length > 0 && (
        <div className="pc-reactions">
          {reactionCounts.map(([emo, count]) => (
            <span key={emo} className="pc-emo-count">{emo} {count}</span>
          ))}
        </div>
      )}

      {commentOpen && (
        <div className="pc-comment-box" role="region" aria-label="Comments">
          {comments.length ? (
            <ul className="pc-comments">
              {comments.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <div className="pc-empty">No comments</div>
          )}
          <form
            className="pc-addcmt"
            onSubmit={(e) => {
              e.preventDefault();
              const t = cmtRef.current?.value.trim();
              if (!t) return;
              bus.emit?.("post:comment", { id: post.id, body: t });
              if (cmtRef.current) cmtRef.current.value = "";
            }}
          >
            <input ref={cmtRef} name="cmt" placeholder="Write a comment…" />
            <button type="submit">Send</button>
          </form>
          <button
            className="pc-comment-close"
            onClick={() => setCommentOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}

      {remixOpen && (
        <div className="pc-remix-box" role="region" aria-label="Remix">
          <div className="pc-empty">Remix area</div>
          <button
            className="pc-comment-close"
            onClick={() => setRemixOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </article>
  );
}

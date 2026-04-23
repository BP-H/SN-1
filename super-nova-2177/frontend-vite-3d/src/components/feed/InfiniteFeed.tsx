import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchImages, FeedImage, ProviderName } from "../../lib/imageProviders";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { sharePost } from "../../hooks/useShare";
import bus from "../../lib/bus";
import "./infinitefeed.css";
import SkeletonCard from "./SkeletonCard";

/**
 * InfiniteFeed
 * - True infinite scroll via IntersectionObserver
 * - Default provider: Picsum (no key). If you add localStorage.sn.keys.unsplash or .pexels, set provider prop.
 * - Compatible with your Orb: each card has data-post-id and .pc-media img for tint.
 */
export default function InfiniteFeed({
  provider = "picsum",
  query = "",
  perPage = 20,
}: {
  provider?: ProviderName;
  query?: string;
  perPage?: number;
}) {
  const [pageInternal, setPageInternal] = useState(1);
  const [list, setList] = useState<FeedImage[]>([]);

  const loadMore = useCallback(async () => {
    const next = await fetchImages({ provider, page: pageInternal, perPage, query });
    setPageInternal((p) => p + 1);
    return next;
  }, [provider, perPage, pageInternal, query]);

  const { items, setItems, loading, error, sentinelRef } = useInfiniteScroll<FeedImage>({
    loadMore,
    hasMore: true,
    rootMargin: "800px 0px",
  });

  // hydrate items into list (kept separate so we can reset on provider/query change)
  useEffect(() => { setList(items); }, [items]);

  // reset on provider or query change
  useEffect(() => {
    setList([]); setItems([]); setPageInternal(1);
  }, [provider, query, setItems]);

  // Bus hooks (optional): external refresh / provider switch
  useEffect(() => {
    const r = bus.on("feed:refresh", () => {
      setList([]); setItems([]); setPageInternal(1);
    });
    const s = bus.on("feed:provider-change", (p?: { provider?: ProviderName; query?: string }) => {
      // parent can re-render with new props, but this adds a quick path
      if (p?.provider) (document.body.dataset as any).feedProvider = p.provider;
    });
    return () => { r?.(); s?.(); };
  }, [setItems]);

  const cards = useMemo(() => list, [list]);

  return (
    <div className="inf-feed">
      {cards.map((img) => (
        <article
          key={img.id}
          className="if-card"
          data-post-id={img.id}
        >
          <header className="if-head">
            <div className="if-author">
              <div className="dot" />
              <span className="name">{img.author || "photographer"}</span>
            </div>
            <a className="src" href={img.link || "#"} target="_blank" rel="noreferrer">source ↗</a>
          </header>

          <div className="pc-media if-media">
            <img
              src={img.thumb}
              data-src={img.src}
              alt={img.author || "image"}
              loading="lazy"
              decoding="async"
              onLoad={(e) => {
                const el = e.currentTarget;
                // upgrade if we were still on thumb
                if (el.dataset.src && el.src.indexOf("picsum.photos/id") > -1 && el.src.includes("/200/")) {
                  el.src = el.dataset.src as string;
                  delete el.dataset.src;
                }
              }}
            />
          </div>

          <div className="pc-botbar if-actions">
            <div className="pc-actions">
              <button className="pc-act" data-drop="like" title="Like">
                <span className="ico heart" /><span>Like</span>
              </button>
              <button className="pc-act" data-drop="comment" title="Comment">
                <span className="ico comment" /><span>Comment</span>
              </button>
              <button className="pc-act" data-drop="world" title="World">
                <span className="ico world" /><span>World</span>
              </button>
              <button
                className="pc-act"
                data-drop="share"
                title="Share"
                onClick={() =>
                  sharePost(
                    img.link || (typeof window !== "undefined" ? window.location.href : ""),
                    img.author
                  )
                }
              >
                <span className="ico share" /><span>Share</span>
              </button>
              <button className="pc-act" data-drop="save" title="Save">
                <span className="ico save" /><span>Save</span>
              </button>
            </div>
          </div>
        </article>
      ))}

      {loading &&
        Array.from({ length: perPage }).map((_, i) => (
          <SkeletonCard key={`skeleton-${i}`} />
        ))}

      {/* sentinel for infinite scroll */}
      <div ref={sentinelRef} className="if-sentinel">
        {loading ? "loading…" : error ? `error: ${error}` : "•"}
      </div>
    </div>
  );
}

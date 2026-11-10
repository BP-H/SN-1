"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FaExternalLinkAlt, FaPlay } from "react-icons/fa";
import { getYouTubeId, youTubeEmbedUrl } from "@/utils/videoUrls";
import { loadYouTubePlayerApi } from "@/utils/youtubePlayer";

const PLAY_EVENT = "supernova:video-play";

export default function FeedVideoPlayer({ source, src, title = "Video" }) {
  const id = useId();
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const visibleRef = useRef(false);
  const userPausedRef = useRef(false);
  const automaticPauseRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [mostlyVisible, setMostlyVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [portrait, setPortrait] = useState(/youtube\.com\/shorts\//i.test(source));
  const youtubeId = getYouTubeId(source);
  const thumbnailSizes = ["maxresdefault", "sddefault", "hqdefault"];
  const thumbnail = youtubeId && thumbnailIndex < thumbnailSizes.length
    ? `https://i.ytimg.com/vi/${youtubeId}/${thumbnailSizes[thumbnailIndex]}.jpg`
    : "";
  const embed = youtubeId ? youTubeEmbedUrl(source, typeof window !== "undefined" ? window.location.origin : "") : "";

  const announcePlayback = () => window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: { id } }));

  const pausePlayback = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused) {
      automaticPauseRef.current = true;
      video.pause();
    }
    playerRef.current?.pauseVideo?.();
    if (youtubeId && !playerRef.current) {
      setOpen(false);
      setLoaded(false);
    }
  }, [youtubeId]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return undefined;
    if (!window.IntersectionObserver) {
      visibleRef.current = true;
      setVisible(true);
      // Without visibility observation, require manual native playback.
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      const next = entry.isIntersecting && entry.intersectionRatio > 0;
      visibleRef.current = next;
      setVisible(next);
      setMostlyVisible(entry.isIntersecting && entry.intersectionRatio >= 0.55);
    }, { threshold: [0, 0.55] });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleOtherVideo = (event) => {
      if (event.detail?.id !== id) pausePlayback();
    };
    const handleVisibility = () => {
      if (document.hidden) pausePlayback();
    };
    window.addEventListener(PLAY_EVENT, handleOtherVideo);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener(PLAY_EVENT, handleOtherVideo);
      document.removeEventListener("visibilitychange", handleVisibility);
      pausePlayback();
    };
  }, [id, pausePlayback]);

  useEffect(() => {
    if (!visible) pausePlayback();
    const video = videoRef.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (mostlyVisible && !document.hidden && video && !userPausedRef.current && !reducedMotion && !navigator.connection?.saveData) {
      // Keep explicit user pauses; only preview while most of the video is in
      // view. Native controls remain usable if autoplay is blocked.
      video.play()?.catch(() => {});
    }
  }, [mostlyVisible, pausePlayback, visible]);

  useEffect(() => {
    if (!open || !youtubeId) return undefined;
    let active = true;
    let player;
    loadYouTubePlayerApi().then((YT) => {
      if (!active || !iframeRef.current) return;
      player = new YT.Player(iframeRef.current, {
        events: {
          onReady: (event) => {
            if (!active) return;
            playerRef.current = event.target;
            setLoaded(true);
            if (!visibleRef.current || document.hidden) event.target.pauseVideo();
          },
          onStateChange: (event) => {
            if (!active || event.data !== 1) return;
            if (!visibleRef.current || document.hidden) event.target.pauseVideo();
            else window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: { id } }));
          },
          onError: () => { if (active) setFailed(true); },
        },
      });
    }).catch(() => {
      // An ad blocker can prevent the optional API. Keep the visible native
      // YouTube controls usable; remove an uncontrolled iframe offscreen.
    });
    return () => {
      active = false;
      playerRef.current = null;
      // React owns the iframe DOM; avoid Player.destroy() removing its node.
      try { player?.pauseVideo?.(); } catch { /* Already navigating away. */ }
    };
  }, [id, open, youtubeId]);

  useEffect(() => {
    if (!visible && open && loaded && !playerRef.current) {
      setOpen(false);
      setLoaded(false);
    }
  }, [loaded, open, visible]);

  const openYouTube = () => {
    announcePlayback();
    setFailed(false);
    setLoaded(false);
    setOpen(true);
  };

  return (
    <div className="mobile-media-bleed overflow-hidden rounded-[1.15rem] border border-[var(--horizontal-line)] bg-black shadow-sm" onClick={(event) => event.stopPropagation()}>
      <div
        ref={frameRef}
        className={`feed-video-frame relative w-full overflow-hidden bg-black ${portrait ? "feed-video-frame--portrait" : ""}`}
        data-feed-video={youtubeId ? "youtube" : "native"}
      >
        {youtubeId ? (
          open ? (
            <>
              <iframe
                ref={iframeRef}
                src={embed}
                title={title || "YouTube video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full border-0"
                onLoad={() => setLoaded(true)}
              />
              {!loaded && <span role="status" className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs text-white">Loading video…</span>}
            </>
          ) : (
            <button type="button" onClick={openYouTube} aria-label={`Play video: ${title || "YouTube"}`} className="group absolute inset-0 h-full w-full">
              {thumbnail && (
                <img
                  src={thumbnail}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                  onLoad={(event) => {
                    // YouTube sometimes returns a 120px placeholder with HTTP
                    // 200 instead of failing when max-resolution art is absent.
                    if (event.currentTarget.naturalWidth <= 120) setThumbnailIndex((index) => index + 1);
                  }}
                  onError={() => setThumbnailIndex((index) => index + 1)}
                />
              )}
              <span className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/20" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/35 bg-[var(--pink)] text-xl text-white shadow-lg transition-transform group-hover:scale-105"><FaPlay className="ml-1" /></span>
              </span>
            </button>
          )
        ) : (
          <video
            ref={videoRef}
            src={src}
            aria-label={title || "Video"}
            controls
            playsInline
            muted
            preload="metadata"
            className="absolute inset-0 h-full w-full object-contain"
            onLoadedMetadata={(event) => setPortrait(event.currentTarget.videoHeight > event.currentTarget.videoWidth)}
            onPlay={() => { userPausedRef.current = false; announcePlayback(); }}
            onPause={() => {
              if (!automaticPauseRef.current && visibleRef.current && !document.hidden) userPausedRef.current = true;
              automaticPauseRef.current = false;
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {youtubeId && (
        <div className="flex items-center justify-between gap-3 bg-black px-3 py-2 text-[0.72rem] text-white/70">
          <span>{failed ? "This video cannot play here." : open ? "Use player controls for sound" : "YouTube"}</span>
          <a href={`https://www.youtube.com/watch?v=${youtubeId}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-white hover:underline">Watch on YouTube <FaExternalLinkAlt aria-hidden="true" /></a>
        </div>
      )}
      {!youtubeId && failed && <p role="status" className="bg-black px-3 py-2 text-xs text-white">Unable to play this video. <a href={src} target="_blank" rel="noopener noreferrer" className="underline">Open video</a></p>}
    </div>
  );
}

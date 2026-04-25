"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoChevronBack,
  IoChevronForward,
  IoClose,
} from "react-icons/io5";

function CoverImage({ src, alt = "", onLoad }) {
  return (
    <img
      src={src}
      alt={alt}
      onLoad={onLoad}
      draggable={false}
      className="absolute inset-0 block h-full w-full object-cover"
    />
  );
}

function getSwipePoint(event) {
  const touch = event.changedTouches?.[0] || event.touches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  return { x: event.clientX, y: event.clientY };
}

export default function MediaGallery({ images = [], layout = "carousel", title = "", getUrl }) {
  const railRef = useRef(null);
  const carouselSwipeRef = useRef({ active: false, x: 0, y: 0, moved: false });
  const lightboxSwipeRef = useRef({ active: false, x: 0, y: 0, moved: false });
  const suppressCarouselClickRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [frameRatio, setFrameRatio] = useState(0.8);

  const urls = useMemo(
    () => images.map((image) => (getUrl ? getUrl(image) : image)).filter(Boolean),
    [getUrl, images]
  );

  useEffect(() => {
    setActiveIndex(0);
    setLightboxIndex(null);
  }, [layout, urls.length]);

  const safeLayout = layout === "grid" && urls.length > 1 ? "grid" : "carousel";
  const showLightbox = lightboxIndex !== null && typeof document !== "undefined";
  const carouselFrameStyle = { aspectRatio: `${frameRatio} / 1` };
  const gridFrameStyle = { height: "clamp(11.5rem, 52vw, 18rem)" };

  const updateFrameRatio = (event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    setFrameRatio(Math.max(0.82, Math.min(1.36, naturalWidth / naturalHeight)));
  };

  const updateIndexFromScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    const nextIndex = Math.round(rail.scrollLeft / Math.max(rail.clientWidth, 1));
    setActiveIndex(Math.min(Math.max(nextIndex, 0), urls.length - 1));
  };

  const scrollToIndex = (index) => {
    const nextIndex = (index + urls.length) % urls.length;
    setActiveIndex(nextIndex);
    railRef.current?.scrollTo({
      left: nextIndex * railRef.current.clientWidth,
      behavior: "smooth",
    });
  };

  const goTo = (index) => {
    const nextIndex = (index + urls.length) % urls.length;
    setLightboxIndex(nextIndex);
  };

  const startSwipe = (ref, event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const point = getSwipePoint(event);
    ref.current = { active: true, x: point.x, y: point.y, moved: false };
  };

  const trackSwipe = (ref, event) => {
    if (!ref.current.active) return;
    const point = getSwipePoint(event);
    const deltaX = point.x - ref.current.x;
    const deltaY = point.y - ref.current.y;
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      ref.current = { ...ref.current, moved: true };
    }
  };

  const finishSwipe = (ref, event, minDistance = 44) => {
    const state = ref.current;
    if (!state.active) return { moved: false, direction: 0 };
    const point = getSwipePoint(event);
    const deltaX = point.x - state.x;
    const deltaY = point.y - state.y;
    const moved = state.moved || Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8;
    const isSwipe = Math.abs(deltaX) >= minDistance && Math.abs(deltaX) >= Math.abs(deltaY) * 1.18;
    ref.current = { active: false, x: 0, y: 0, moved: false };
    return { moved, direction: isSwipe ? (deltaX < 0 ? 1 : -1) : 0 };
  };

  const cancelSwipe = (ref) => {
    ref.current = { active: false, x: 0, y: 0, moved: false };
  };

  const openLightbox = (index) => {
    setActiveIndex(index);
    setLightboxIndex(index);
  };

  const startLightboxSwipe = (event) => {
    startSwipe(lightboxSwipeRef, event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const finishLightboxSwipe = (event) => {
    if (urls.length <= 1) return;
    const swipe = finishSwipe(lightboxSwipeRef, event, 42);
    if (!swipe.direction) return;
    event.preventDefault();
    goTo(lightboxIndex + swipe.direction);
  };

  const finishCarouselSwipe = (event) => {
    if (urls.length <= 1) return;
    const swipe = finishSwipe(carouselSwipeRef, event, 42);
    if (swipe.moved) {
      suppressCarouselClickRef.current = true;
      window.setTimeout(() => {
        suppressCarouselClickRef.current = false;
      }, 180);
    }
    if (!swipe.direction) return;
    event.preventDefault();
    event.stopPropagation();
    scrollToIndex(activeIndex + swipe.direction);
  };

  useEffect(() => {
    if (lightboxIndex === null) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") goTo(lightboxIndex - 1);
      if (event.key === "ArrowRight") goTo(lightboxIndex + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, urls.length]);

  if (urls.length === 0) return null;

  const lightbox = showLightbox
    ? createPortal(
        <div className="vote-modal-backdrop" onClick={() => setLightboxIndex(null)}>
          <div
            className="relative flex h-[calc(100dvh-1.5rem)] w-[calc(100vw-1rem)] max-w-[44rem] items-center justify-center overflow-hidden rounded-[0.85rem] bg-black"
            style={{ touchAction: "pan-y" }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={startLightboxSwipe}
            onPointerMove={(event) => trackSwipe(lightboxSwipeRef, event)}
            onPointerUp={finishLightboxSwipe}
            onPointerCancel={() => cancelSwipe(lightboxSwipeRef)}
            onTouchStart={(event) => startSwipe(lightboxSwipeRef, event)}
            onTouchMove={(event) => trackSwipe(lightboxSwipeRef, event)}
            onTouchEnd={finishLightboxSwipe}
            onTouchCancel={() => cancelSwipe(lightboxSwipeRef)}
          >
            <button
              type="button"
              aria-label="Close image"
              onClick={() => setLightboxIndex(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
            >
              <IoClose />
            </button>

            {urls.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => goTo(lightboxIndex - 1)}
                  className="absolute left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
                >
                  <IoChevronBack />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => goTo(lightboxIndex + 1)}
                  className="absolute right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
                >
                  <IoChevronForward />
                </button>
              </>
            )}

            <img
              src={urls[lightboxIndex]}
              alt={title || "Post image"}
              draggable={false}
              className="h-full w-full object-contain"
            />

            {urls.length > 1 && (
              <span className="absolute bottom-3 rounded-full bg-black/55 px-3 py-1 text-[0.75rem] font-semibold text-white">
                {lightboxIndex + 1}/{urls.length}
              </span>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  if (safeLayout === "grid") {
    const visible = urls.slice(0, 4);
    const hiddenCount = Math.max(0, urls.length - 4);

    if (urls.length >= 4) {
      return (
        <>
          <div className="mobile-media-bleed overflow-hidden rounded-[1rem] bg-[var(--gray)]">
            <div className="grid min-h-0 grid-cols-[minmax(0,1.58fr)_minmax(0,0.9fr)] gap-1" style={gridFrameStyle}>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openLightbox(0);
                }}
                className="relative h-full min-h-0 overflow-hidden bg-black/20"
                aria-label="Open image 1"
              >
                <CoverImage src={visible[0]} alt={title || "Post image 1"} onLoad={updateFrameRatio} />
              </button>
              <div className="grid grid-rows-3 gap-1">
                {visible.slice(1, 4).map((url, offset) => {
                  const index = offset + 1;
                  const isOverlay = index === 3 && hiddenCount > 0;
                  return (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openLightbox(index);
                      }}
                      className="relative min-h-0 overflow-hidden bg-black/20"
                      aria-label={`Open image ${index + 1}`}
                    >
                      <CoverImage src={url} alt={title || `Post image ${index + 1}`} />
                      {isOverlay && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-bold text-white">
                          +{hiddenCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {lightbox}
        </>
      );
    }

    if (urls.length === 3) {
      return (
        <>
          <div className="mobile-media-bleed overflow-hidden rounded-[1rem] bg-[var(--gray)]">
            <div className="grid min-h-0 grid-cols-[minmax(0,1.58fr)_minmax(0,0.9fr)] gap-1" style={gridFrameStyle}>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openLightbox(0);
                }}
                className="relative h-full min-h-0 overflow-hidden bg-black/20"
                aria-label="Open image 1"
              >
                <CoverImage src={visible[0]} alt={title || "Post image 1"} onLoad={updateFrameRatio} />
              </button>
              <div className="grid grid-rows-2 gap-1">
                {visible.slice(1, 3).map((url, offset) => {
                  const index = offset + 1;
                  return (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openLightbox(index);
                      }}
                      className="relative min-h-0 overflow-hidden bg-black/20"
                      aria-label={`Open image ${index + 1}`}
                    >
                      <CoverImage src={url} alt={title || `Post image ${index + 1}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {lightbox}
        </>
      );
    }

    return (
      <>
        <div className="mobile-media-bleed overflow-hidden rounded-[1rem] bg-[var(--gray)]">
          <div className="grid min-h-0 grid-cols-2 gap-1" style={gridFrameStyle}>
            {visible.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openLightbox(index);
                }}
                className="relative min-h-0 overflow-hidden bg-black/20"
                aria-label={`Open image ${index + 1}`}
              >
                <CoverImage src={url} alt={title || `Post image ${index + 1}`} onLoad={index === 0 ? updateFrameRatio : undefined} />
              </button>
            ))}
          </div>
        </div>
        {lightbox}
      </>
    );
  }

  return (
    <>
      <div className="mobile-media-bleed overflow-hidden rounded-[1rem] bg-[var(--gray)]">
        <div className="relative">
          <div
            ref={railRef}
            onScroll={updateIndexFromScroll}
            onPointerDown={(event) => {
              startSwipe(carouselSwipeRef, event);
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => trackSwipe(carouselSwipeRef, event)}
            onPointerUp={finishCarouselSwipe}
            onPointerCancel={() => cancelSwipe(carouselSwipeRef)}
            onTouchStart={(event) => startSwipe(carouselSwipeRef, event)}
            onTouchMove={(event) => trackSwipe(carouselSwipeRef, event)}
            onTouchEnd={finishCarouselSwipe}
            onTouchCancel={() => cancelSwipe(carouselSwipeRef)}
            className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto"
            style={{ touchAction: "pan-y" }}
          >
          {urls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (suppressCarouselClickRef.current) return;
                openLightbox(index);
              }}
              className="relative min-w-full snap-center overflow-hidden bg-black/20"
              style={carouselFrameStyle}
              aria-label={`Open image ${index + 1}`}
            >
              <CoverImage src={url} alt={title || `Post image ${index + 1}`} onLoad={index === 0 ? updateFrameRatio : undefined} />
            </button>
          ))}
          </div>
          {urls.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  scrollToIndex(activeIndex - 1);
                }}
                className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/38 text-white backdrop-blur"
              >
                <IoChevronBack />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  scrollToIndex(activeIndex + 1);
                }}
                className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/38 text-white backdrop-blur"
              >
                <IoChevronForward />
              </button>
              <span className="absolute right-2 top-2 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[0.68rem] font-semibold text-white">
                {activeIndex + 1}/{urls.length}
              </span>
            </>
          )}
        </div>
        {urls.length > 1 && (
          <div className="flex items-center justify-center px-3 py-2">
            <div className="flex items-center gap-1.5">
              {urls.map((url, index) => (
                <span
                  key={`${url}-dot-${index}`}
                  className={`h-1.5 rounded-full transition-all ${
                    index === activeIndex ? "w-4 bg-[var(--pink)]" : "w-1.5 bg-white/25"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {lightbox}
    </>
  );
}

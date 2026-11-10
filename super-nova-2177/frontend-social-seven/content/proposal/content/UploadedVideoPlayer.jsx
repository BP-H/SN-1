"use client";

import { useEffect, useRef, useState } from "react";
import { FaCompress, FaExpand, FaPause, FaPlay, FaVolumeMute, FaVolumeUp } from "react-icons/fa";

function clock(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function UploadedVideoPlayer({ videoRef, frameRef, src, title, onMetadata, onPlay, onPause, onError }) {
  const [enhanced, setEnhanced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [activity, setActivity] = useState(0);
  const [notice, setNotice] = useState("");
  const surfaceRef = useRef(null);
  const seekPointerRef = useRef(null);

  useEffect(() => {
    setEnhanced(true);
    const video = videoRef.current;
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === frameRef.current);
    const endNativeFullscreen = () => { if (video) video.controls = false; };
    document.addEventListener("fullscreenchange", updateFullscreen);
    video?.addEventListener("webkitendfullscreen", endNativeFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreen);
      video?.removeEventListener("webkitendfullscreen", endNativeFullscreen);
      video?.pause();
    };
  }, [frameRef, videoRef]);

  useEffect(() => {
    setControlsVisible(true);
    if (!playing || scrubbing || keyboardFocus) return undefined;
    const timer = window.setTimeout(() => setControlsVisible(false), 2800);
    return () => window.clearTimeout(timer);
  }, [activity, keyboardFocus, playing, scrubbing]);

  const reveal = () => {
    setControlsVisible(true);
    setActivity((value) => value + 1);
  };

  const updateTimeline = (video) => {
    // Some streams expose their finite seekable window before duration settles.
    const end = Number.isFinite(video.duration) ? video.duration
      : video.seekable.length ? video.seekable.end(video.seekable.length - 1) : 0;
    setDuration(Number.isFinite(end) && end > 0 ? end : 0);
    if (!scrubbing) setPosition(video.currentTime || 0);
    setBuffered(video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    reveal();
    if (video.paused || video.ended) {
      video.play()?.catch((error) => {
        if (error.name !== "AbortError") setNotice("Tap play to start the video.");
      });
    } else video.pause();
  };

  const seekTo = (value) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const next = Math.max(0, Math.min(Number(value), duration));
    if (!Number.isFinite(next)) return;
    try {
      video.currentTime = next;
      setPosition(next);
      setNotice("");
    } catch {
      setNotice("The video is still loading. Try seeking again in a moment.");
    }
    reveal();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 1;
    setMuted(video.muted);
    reveal();
  };

  const seekFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width > 0) seekTo((event.clientX - bounds.left) / bounds.width * duration);
  };

  const finishSeek = (event, cancelled = false) => {
    if (seekPointerRef.current !== event.pointerId) return;
    if (!cancelled) seekFromPointer(event);
    seekPointerRef.current = null;
    setScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const toggleFullscreen = async () => {
    reveal();
    const video = videoRef.current;
    try {
      if (document.fullscreenElement === frameRef.current) await document.exitFullscreen();
      else if (frameRef.current?.requestFullscreen && document.fullscreenEnabled) await frameRef.current.requestFullscreen();
      else if (video?.webkitEnterFullscreen) {
        video.controls = true;
        video.webkitEnterFullscreen();
      } else setNotice("Fullscreen is not available in this browser.");
    } catch {
      if (video) video.controls = false;
      setNotice("Fullscreen is not available right now.");
    }
  };

  return (
    <div
      ref={surfaceRef}
      className="uploaded-video-surface absolute inset-0"
      onPointerMove={(event) => { if (event.pointerType === "mouse") reveal(); }}
      onFocusCapture={(event) => {
        if (event.target.matches?.(":focus-visible")) setKeyboardFocus(true);
        reveal();
      }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocus(false); }}
    >
      <video
        ref={videoRef}
        src={src}
        aria-label={title || "Video"}
        controls={!enhanced}
        playsInline
        muted
        preload="metadata"
        className="absolute inset-0 h-full w-full object-contain"
        onLoadedMetadata={(event) => { updateTimeline(event.currentTarget); onMetadata?.(event); }}
        onDurationChange={(event) => updateTimeline(event.currentTarget)}
        onTimeUpdate={(event) => updateTimeline(event.currentTarget)}
        onProgress={(event) => updateTimeline(event.currentTarget)}
        onPlay={(event) => {
          if (event.currentTarget.paused) return;
          setPlaying(true);
          setNotice("");
          onPlay?.(event);
        }}
        onPause={(event) => { setPlaying(false); setWaiting(false); onPause?.(event); }}
        onEnded={() => { setPlaying(false); setWaiting(false); }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted || event.currentTarget.volume === 0)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onSeeked={(event) => { updateTimeline(event.currentTarget); setWaiting(false); }}
        onError={(event) => { setWaiting(false); onError?.(event); }}
      />
      {enhanced && (
        <>
          <button
            type="button"
            className="uploaded-video-tap-target absolute inset-0 flex h-full w-full items-center justify-center"
            aria-label={playing ? "Pause video" : "Play video"}
            onClick={togglePlayback}
          >
            {!playing && <span className="uploaded-video-play-disc"><FaPlay aria-hidden="true" className="ml-1" /></span>}
          </button>
          {waiting && playing && <span role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="loading-spinner-glyph h-9 w-9" aria-label="Buffering video" /></span>}
          <div className={`uploaded-video-controls ${controlsVisible ? "" : "uploaded-video-controls--hidden"}`} role="group" aria-label="Video controls">
            <input
              type="range"
              className="uploaded-video-seek"
              aria-label="Seek video"
              aria-valuetext={`${clock(position)} of ${clock(duration)}`}
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(position, duration) || 0}
              disabled={!duration}
              style={{ "--video-progress": `${duration ? position / duration * 100 : 0}%`, "--video-buffered": `${duration ? buffered / duration * 100 : 0}%` }}
              onPointerDown={(event) => {
                if (!duration || event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.focus({ preventScroll: true });
                event.currentTarget.setPointerCapture(event.pointerId);
                seekPointerRef.current = event.pointerId;
                setScrubbing(true);
                seekFromPointer(event);
              }}
              onPointerMove={(event) => {
                if (seekPointerRef.current !== event.pointerId) return;
                event.preventDefault();
                seekFromPointer(event);
              }}
              onPointerUp={(event) => finishSeek(event)}
              onPointerCancel={(event) => finishSeek(event, true)}
              onLostPointerCapture={() => { seekPointerRef.current = null; setScrubbing(false); }}
              onBlur={() => { seekPointerRef.current = null; setScrubbing(false); }}
              onClick={(event) => event.preventDefault()}
              onChange={(event) => seekTo(event.currentTarget.value)}
            />
            <div className="uploaded-video-control-row">
              <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause playback" : "Resume playback"} className="uploaded-video-control"><span aria-hidden="true">{playing ? <FaPause /> : <FaPlay />}</span></button>
              <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute video" : "Mute video"} className="uploaded-video-control"><span aria-hidden="true">{muted ? <FaVolumeMute /> : <FaVolumeUp />}</span></button>
              <span className="uploaded-video-time" aria-hidden="true">{clock(position)} / {clock(duration)}</span>
              <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} className="uploaded-video-control ml-auto"><span aria-hidden="true">{fullscreen ? <FaCompress /> : <FaExpand />}</span></button>
            </div>
          </div>
          {notice && <span role="status" className="pointer-events-none absolute left-3 right-3 top-3 rounded-lg bg-black/75 px-3 py-2 text-xs text-white">{notice}</span>}
        </>
      )}
    </div>
  );
}

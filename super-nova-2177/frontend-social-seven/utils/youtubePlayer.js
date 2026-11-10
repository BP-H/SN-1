let apiPromise;

// Load only after a viewer chooses a YouTube video, and share one API script
// across the feed. If blocked, the normal iframe controls still work.
export function loadYouTubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error("YouTube player API timed out")), 12000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      try { previousReady?.(); } finally { resolve(window.YT); }
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("YouTube player API unavailable"));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    apiPromise = undefined;
    throw error;
  });
  return apiPromise;
}

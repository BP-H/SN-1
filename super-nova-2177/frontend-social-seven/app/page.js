"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useUser } from "@/content/profile/UserContext";

const WELCOME_SEEN = "supernova-about-seen";
const WELCOME_HOSTS = new Set([
  "www.2177.tech", "2177.tech", "www.supernova2177.com", "supernova2177.com",
  "localhost", "127.0.0.1",
]);
const AUTH_RETURN_PARAMS = ["code", "access_token", "refresh_token", "token", "token_hash", "error", "error_code", "error_description"];

function LoadingHome() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--backgroundGray)] text-[var(--text-black)]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.04] shadow-[var(--shadow-pink)]">
        <span className="loading-spinner-glyph h-12 w-12" role="img" aria-label="Loading" />
      </div>
    </div>
  );
}

const HomeWrapper = dynamic(() => import("@/content/home/HomeWrapper"), {
  ssr: false,
  loading: LoadingHome,
});

export default function Page() {
  const { authLoading, isAuthenticated } = useUser();
  const [showFeed, setShowFeed] = useState(false);

  useEffect(() => {
    if (showFeed) return;
    const { hostname, hash, search } = window.location;
    // Keep this scoped to the requested domains and local/preview verification.
    if (!WELCOME_HOSTS.has(hostname) && process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview") {
      setShowFeed(true);
      return;
    }

    // OAuth can return to / with a fragment that server redirects cannot see.
    const params = new URLSearchParams(search);
    const authReturn = Boolean(hash) || AUTH_RETURN_PARAMS.some((key) => params.has(key));

    try {
      if (window.localStorage.getItem(WELCOME_SEEN) !== "1") {
        if (authLoading && !authReturn) return;
        window.localStorage.setItem(WELCOME_SEEN, "1");
        if (!isAuthenticated && !authReturn) {
          window.location.replace(`/about${search}`);
          return;
        }
      }
    } catch {
      // If browser storage is unavailable, keep the feed reachable.
    }
    setShowFeed(true);
  }, [authLoading, isAuthenticated, showFeed]);

  return showFeed ? <HomeWrapper /> : <LoadingHome />;
}

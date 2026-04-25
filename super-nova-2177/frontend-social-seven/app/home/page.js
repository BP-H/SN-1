"use client";

import dynamic from "next/dynamic";

const HomeWrapper = dynamic(() => import("@/content/home/HomeWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--backgroundGray)] text-[var(--text-black)]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.04] shadow-[var(--shadow-pink)]">
        <span className="loading-spinner-glyph h-12 w-12" role="img" aria-label="Loading" />
      </div>
    </div>
  ),
});

export default function Page() {
  return <HomeWrapper />;
}

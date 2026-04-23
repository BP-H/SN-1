"use client";

import dynamic from "next/dynamic";

const HomeWrapper = dynamic(() => import("@/content/home/HomeWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--backgroundGray)] text-[var(--text-black)]">
      <div className="social-panel rounded-[1.75rem] px-8 py-6 text-center">
        <h1 className="mb-2 text-[1.2rem] font-black">Loading SuperNova Seven</h1>
        <p className="text-[0.95rem] opacity-70">
          Bringing the live neon feed online.
        </p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <HomeWrapper />;
}

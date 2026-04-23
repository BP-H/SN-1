"use client";

import dynamic from "next/dynamic";

const ProposalWrapper = dynamic(() => import("@/content/proposal/ProposalWrapper"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--backgroundGray)] text-[var(--text-black)]">
      <div className="bgWhiteTrue rounded-[28px] shadow-md px-8 py-6 text-center">
        <h1 className="text-[1.25rem] font-black mb-2">Loading Social Six</h1>
        <p className="text-[0.95rem] opacity-70">
          Bringing the feed online with the social profile layer.
        </p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <ProposalWrapper />;
}

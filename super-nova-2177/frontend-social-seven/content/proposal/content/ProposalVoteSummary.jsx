"use client";

import { IoCheckmark } from "react-icons/io5";

export default function ProposalVoteSummary({ supportSummary }) {
  if (!supportSummary) return null;

  return (
    <div className="proposal-support-summary mt-2 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em]">
      <IoCheckmark className="text-[0.82rem]" />
      <span className="truncate">{supportSummary}</span>
    </div>
  );
}

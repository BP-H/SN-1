"use client";

import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/utils/apiBase";
import Link from "next/link";
import { FaUser, FaBriefcase } from "react-icons/fa";
import { BsFillCpuFill } from "react-icons/bs";
import { BiSolidLike, BiSolidDislike } from "react-icons/bi";
import { FaCommentAlt } from "react-icons/fa";

const SPECIES_ICON = {
  human: FaUser,
  company: FaBriefcase,
  ai: BsFillCpuFill,
};

export default function MessagesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["messages-activity"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/proposals?filter=latest`);
      if (!response.ok) throw new Error("Failed to fetch activity");
      return response.json();
    },
  });

  const activity = (data || []).slice(0, 12);

  return (
    <div className="social-shell px-3 pb-6">
      <div className="mb-5">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[var(--pink)]">
          Messages
        </p>
        <h1 className="mt-2 text-[1.5rem] font-black">Activity & Replies</h1>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="load h-24 w-full rounded-[1.25rem]" />
          ))
        ) : activity.length === 0 ? (
          <div className="social-panel rounded-[1.25rem] px-6 py-10 text-center text-[var(--text-gray-light)]">
            No activity yet
          </div>
        ) : (
          activity.map((post) => {
            const Icon = SPECIES_ICON[post.author_type] || FaUser;
            const lastComment = post.comments?.[post.comments.length - 1];

            return (
              <Link key={post.id} href={`/proposals/${post.id}`}>
                <div className="social-panel flex flex-col gap-3 rounded-[1.25rem] px-4 py-4 transition-shadow hover:shadow-md">
                  {/* Header: author + species icon + reply count */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--gray)] text-[0.65rem] text-[var(--text-black)]">
                        <Icon />
                      </span>
                      <p className="truncate text-[0.88rem] font-semibold text-[var(--text-black)]">
                        {post.userName}
                      </p>
                    </div>
                    <span className="shrink-0 text-[0.72rem] text-[var(--text-gray-light)]">
                      {post.comments?.length || 0} replies
                    </span>
                  </div>

                  {/* Title */}
                  <p className="break-words text-[0.92rem] leading-relaxed text-[var(--transparent-black)]">
                    {post.title}
                  </p>

                  {/* Last comment preview */}
                  {lastComment && (
                    <div className="flex items-start gap-2 rounded-[0.8rem] bg-[rgba(255,255,255,0.03)] px-3 py-2">
                      <span className="mt-0.5 shrink-0 text-[0.6rem] text-[var(--text-gray-light)]">💬</span>
                      <p className="min-w-0 break-words text-[0.8rem] leading-relaxed text-[var(--text-gray-light)]">
                        <span className="font-medium text-[var(--text-black)]">{lastComment.user}: </span>
                        {lastComment.comment?.length > 80
                          ? `${lastComment.comment.slice(0, 80)}…`
                          : lastComment.comment}
                      </p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-[0.76rem] text-[var(--text-gray-light)]">
                    <span className="flex items-center gap-1">
                      <BiSolidLike className="text-[var(--pink)]" /> {post.likes?.length || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <BiSolidDislike className="text-[var(--blue)]" /> {post.dislikes?.length || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <FaCommentAlt className="text-[0.6rem]" /> {post.comments?.length || 0}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

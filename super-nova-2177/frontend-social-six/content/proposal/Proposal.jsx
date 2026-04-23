"use client";

import { useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchInputContext } from "@/app/layout";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";
import CreatePost from "../create post/CreatePost";
import InputFields from "../create post/InputFields";
import CardLoading from "../CardLoading";
import FilterHeader from "../filters/FilterHeader";
import ProposalCard from "./content/ProposalCard";

function formatRelativeTime(dateString) {
  if (!dateString) return "now";

  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return "now";

  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return diffYears === 1 ? "1y" : `${diffYears}y`;
  if (diffMonths > 0) return diffMonths === 1 ? "1mo" : `${diffMonths}mo`;
  if (diffDays > 0) return diffDays === 1 ? "1d" : `${diffDays}d`;
  if (diffHours > 0) return diffHours === 1 ? "1h" : `${diffHours}h`;
  if (diffMin > 0) return diffMin === 1 ? "1min" : `${diffMin}min`;
  return "now";
}

export default function Proposal({ activeBE, setErrorMsg, setNotify }) {
  const [discard, setDiscard] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { inputRef } = useContext(SearchInputContext);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["proposals", filter, search, activeBE],
    queryFn: async () => {
      const filterMap = {
        All: "all",
        Latest: "latest",
        Oldest: "oldest",
        "Top Liked": "topLikes",
        "Less Liked": "fewestLikes",
        Popular: "popular",
        AI: "ai",
        Company: "company",
        Human: "human",
      };

      const filterParam = filterMap[filter];
      let url = `${API_BASE_URL}/proposals?filter=${filterParam}`;
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      return response.json();
    },
    keepPreviousData: true,
  });

  return (
    <div className="social-shell px-4 sm:px-5 lg:px-6">
      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <div className="w-full lg:sticky lg:top-36">
          <FilterHeader
            setSearch={setSearch}
            search={search}
            filter={filter}
            setFilter={setFilter}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5 pb-24 lg:gap-6 lg:pb-10">
          {discard && (
            <div className="lg:hidden">
              <CreatePost discard={discard} setDiscard={setDiscard} />
            </div>
          )}

          {discard ? (
            <div className="hidden lg:flex lg:justify-end">
              <CreatePost discard={discard} setDiscard={setDiscard} />
            </div>
          ) : (
            <div ref={inputRef} className="hidden lg:block">
              <InputFields activeBE={activeBE} setDiscard={setDiscard} />
            </div>
          )}

          {!discard && (
            <div ref={inputRef} className="w-full lg:hidden">
              <InputFields activeBE={activeBE} setDiscard={setDiscard} />
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => <CardLoading key={index} />)
            ) : posts && posts.length > 0 ? (
              posts.map((post) => (
                <ProposalCard
                  key={post.id}
                  id={post.id}
                  userName={post.userName}
                  userInitials={post.userInitials}
                  time={formatRelativeTime(post.time)}
                  title={post.title}
                  logo={post.author_img}
                  media={{
                    image: post.media?.image
                      ? absoluteApiUrl(post.media.image)
                      : post.image
                      ? absoluteApiUrl(post.image)
                      : "",
                    video: post.media?.video || post.video || "",
                    link: post.media?.link || post.link || "",
                    file: post.media?.file
                      ? absoluteApiUrl(post.media.file)
                      : post.file
                      ? absoluteApiUrl(post.file)
                      : "",
                  }}
                  text={post.text}
                  comments={post.comments}
                  likes={post.likes}
                  dislikes={post.dislikes}
                  setErrorMsg={setErrorMsg}
                  setNotify={setNotify}
                  specie={post.author_type}
                  activeBE={activeBE}
                />
              ))
            ) : (
              <div className="social-panel rounded-[28px] px-6 py-10 text-center font-semibold text-gray-500">
                No proposals found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

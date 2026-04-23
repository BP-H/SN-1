"use client";
import { useState, useRef, useEffect } from "react";
import CreatePost from "../create post/CreatePost";
import ProposalCard from "./content/ProposalCard";
import InputFields from "../create post/InputFields";
import CardLoading from "../CardLoading";
import { useQuery } from "@tanstack/react-query";
import FilterHeader from "../filters/FilterHeader";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";

function formatRelativeTime(dateString) {
  if (!dateString) return "now";

  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime(); // em ms

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

import { useContext } from "react";
import { SearchInputContext } from "@/app/layout";

function Proposal({ activeBE, setErrorMsg, setNotify }) {
  const [discard, setDiscard] = useState(true);
  const [filter, setFilter] = useState("All");
  const { inputRef } = useContext(SearchInputContext);
  const [search, setSearch] = useState("");

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
      const apiUrl = API_BASE_URL;
      let url = `${apiUrl}/proposals?filter=${filterParam}`;
      if (search && search.trim() !== "") {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    keepPreviousData: true,
  });

  return (
    <div className="relative flex flex-col-reverse items-center justify-center gap-10 m-auto mt-15 mb-50 lg:mb-10 xl:mx-auto lg:ml-80 lg:flex-row lg:items-start lg:mt-50">
      <div className="flex flex-col gap-10">
        
        <div className="lg:hidden">
          <CreatePost discard={discard} setDiscard={setDiscard} />
        </div>

        {discard ? (
          <div className="hidden lg:block lg:mb-[-40px]">
            <CreatePost discard={discard} setDiscard={setDiscard} />
          </div>
        ) : (
          <div ref={inputRef} className="hidden lg:block">
            <InputFields activeBE={activeBE} setDiscard={setDiscard} />
          </div>
        )}

        {!discard && (
          <div className="w-full lg:hidden">
            <InputFields activeBE={activeBE} setDiscard={setDiscard} />
          </div>
        )}
        <div className="flex flex-col gap-10 lg:flex-col">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <CardLoading key={i} />)
          ) : posts && posts.length > 0 ? (
            posts.map((post, index) => (
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
            <p className="text-center text-gray-500">No Proposals found.</p>
          )}
        </div>
      </div>
      <FilterHeader
        setSearch={setSearch}
        search={search}
        filter={filter}
        setFilter={setFilter}
      />
    </div>
  );
}

export default Proposal;

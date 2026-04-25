"use client";

import { useContext } from "react";
import Filters from "./Filters";
import Input from "./Input";
import { SearchInputContext } from "@/app/layout";

export default function FilterHeader({ filter, setFilter, setSearch, search }) {
  const { inputRef } = useContext(SearchInputContext);

  return (
    <div className="mobile-feed-panel social-panel z-[90] flex w-full flex-col gap-3 rounded-[26px] p-3">
      <Input setSearch={setSearch} search={search} inputRef={inputRef} />
      <Filters filter={filter} setFilter={setFilter} />
    </div>
  );
}

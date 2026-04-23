"use client";

import { useContext, useEffect, useState } from "react";
import Filters from "./Filters";
import Input from "./Input";
import { SearchInputContext } from "@/app/layout";

export default function FilterHeader({ filter, setFilter, setSearch, search }) {
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { inputRef } = useContext(SearchInputContext);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth >= 1024) return;
      const currentScrollY = window.scrollY;
      setShowHeader(!(currentScrollY > lastScrollY && currentScrollY > 50));
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  return (
    <div
      className={`social-panel z-[90] flex w-full items-center justify-between gap-3 rounded-[26px] p-2.5 lg:sticky lg:top-36 lg:w-[15rem] lg:flex-col lg:items-stretch lg:justify-start ${
        showHeader ? "translate-y-0" : "-translate-y-28"
      }`}
    >
      <Filters filter={filter} setFilter={setFilter} />
      <Input setSearch={setSearch} search={search} inputRef={inputRef} />
    </div>
  );
}

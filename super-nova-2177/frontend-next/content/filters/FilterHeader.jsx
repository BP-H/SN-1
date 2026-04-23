"use client";
import { useEffect, useState, useContext } from "react";
import Input from "./Input";
import Filters from "./Filters";
import { SearchInputContext } from "@/app/layout";

function FilterHeader({ filter, setFilter, setSearch, search }) {
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { inputRef } = useContext(SearchInputContext);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth > 1024) return;
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // scroll down
        setShowHeader(false);
      } else {
        // scroll up
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  return (
    <div
      className={`z-90 fixed top-1 lg:top-50 lg:left-10 lg:w-10 xl:top-50 xl:left-1/2 xl:translate-x-[-640px] max-w-65 md:max-w-130 min-w-100 lg:min-w-54 bg-white shadow-md p-2 rounded-[25px] flex flex-row lg:flex-col gap-2 lg:h-26 w-full justify-between mb-[-20px] lg:mb-0 transition-transform duration-300 ${showHeader ? "translate-y-0" : "-translate-y-32"
        }`}
    >
      <Filters filter={filter} setFilter={setFilter} />
      <Input setSearch={setSearch} search={search} inputRef={inputRef} />
    </div>
  );
}

export default FilterHeader;

import { useEffect } from "react";
import { CiSearch } from "react-icons/ci";

function Input({ setSearch, search, inputRef }) {
  useEffect(() => {
    const focusInput = () => {
      inputRef?.current?.focus();
    };

    const pendingFocus =
      typeof window !== "undefined" &&
      sessionStorage.getItem("supernova-focus-search") === "1";

    if (pendingFocus) {
      sessionStorage.removeItem("supernova-focus-search");
      setTimeout(focusInput, 80);
    }

    window.addEventListener("supernova:focus-search", focusInput);
    return () => {
      window.removeEventListener("supernova:focus-search", focusInput);
    };
  }, [inputRef]);

  return (
    <div className="relative w-full">
      <CiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-[var(--text-gray-light)]" />
      <input
        ref={inputRef}
        onChange={(e) => setSearch(e.target.value)}
        value={search}
        type="text"
        placeholder="Search posts, people, ideas"
        className="h-11 w-full rounded-full border border-[var(--horizontal-line)] bg-[var(--surface)] pl-10 pr-4 text-[0.92rem] text-[var(--text-black)] shadow-md outline-none placeholder:text-[var(--text-gray-light)]"
      />
    </div>
  );
}

export default Input;

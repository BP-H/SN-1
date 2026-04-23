import { CiSearch } from "react-icons/ci";

function Input({ setSearch, search, inputRef }) {
  return (
    <div className="relative w-full">
      <CiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-gray-400" />
      <input
        ref={inputRef}
        onChange={(e) => setSearch(e.target.value)}
        value={search}
        type="text"
        placeholder="Search posts, people, ideas"
        className="h-11 w-full rounded-full bg-white pl-10 pr-4 text-[0.92rem] text-[var(--text-black)] shadow-md outline-none placeholder:text-[var(--text-gray-light)]"
      />
    </div>
  );
}

export default Input;

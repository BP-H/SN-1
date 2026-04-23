import { useRef } from "react";
import { CiSearch } from "react-icons/ci";

function Input({ setSearch, search, inputRef }) {
  
  return (
    <div className="relative w-65 min-w-65 md:min-w-95 lg:min-w-50 lg:w-50">
      <CiSearch className="absolute text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
      <input
        ref={inputRef}
        onChange={(e) => setSearch(e.target.value)}
        value={search}
        type="text"
        placeholder="Search for Post"
        className="w-full h-10 pl-10 pr-3 rounded-full shadow-md focus:outline-none"
      />
    </div>
  );
}

export default Input;

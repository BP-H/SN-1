import { useState } from "react";
import { FaAngleDown, FaAngleUp } from "react-icons/fa6";
import content from "../../assets/content.json";

function Filters({ filter, setFilter }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      className="relative bg-white shadow-md rounded-[15px] px-2 py-1 min-h-10 w-27 flex flex-col justify-center z-50"
      onClick={() => setOpen(!open)}
    >
      <div className="flex justify-between items-center">
        <p>{filter}</p>
        {open ? <FaAngleUp /> : <FaAngleDown />}
      </div>
      <div className={`${open ? "" : "hidden"
        } absolute top-full left-0 w-full bg-white shadow-md rounded-[15px] mt-1 border-t border-t-[var(--horizontal-line)]`}>
        <ul
          className={` text-left flex flex-col gap-1 py-2`}
        >
          {Object.values(content.filters).map((filterItem, index) => (
            <li onClick={() => setFilter(filterItem)} key={index} className="hover:bg-[var(--gray)] rounded-full px-2">{filterItem}</li>
          ))}
        </ul>
      </div>
    </button>
  );
}

export default Filters;

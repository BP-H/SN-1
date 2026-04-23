import { useState } from "react";
import { FaAngleDown, FaAngleUp } from "react-icons/fa6";
import content from "../../assets/content.json";

function Filters({ filter, setFilter }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      className="relative z-50 flex min-h-11 w-full min-w-[9.5rem] flex-col justify-center rounded-[16px] border border-[var(--horizontal-line)] bg-[var(--surface)] px-3 py-2 text-left shadow-md lg:w-[12rem]"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[0.92rem] font-medium text-[var(--text-black)]">{filter}</p>
        {open ? <FaAngleUp /> : <FaAngleDown />}
      </div>
      <div
        className={`${open ? "" : "hidden"} absolute left-0 top-[calc(100%+0.45rem)] w-full rounded-[18px] border border-[var(--horizontal-line)] bg-[var(--surface-strong)] p-1 shadow-lg`}
      >
        <ul className="flex flex-col gap-1 py-1 text-left">
          {Object.values(content.filters).map((filterItem, index) => (
            <li
              onClick={() => {
                setFilter(filterItem);
                setOpen(false);
              }}
              key={index}
              className={`rounded-full px-3 py-2 text-[0.9rem] ${
                filterItem === filter
                  ? "bg-[var(--pink)] text-white shadow-[var(--shadow-pink)]"
                  : "text-[var(--text-black)] hover:bg-[var(--gray)]"
              }`}
            >
              {filterItem}
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

export default Filters;

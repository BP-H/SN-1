import { FaPlus } from "react-icons/fa6";
import { IoIosClose } from "react-icons/io";
import LiquidGlass from "../liquid glass/LiquidGlass";

function CreatePost({ discard, setDiscard }) {
  const handleClick = () => {
    setDiscard(!discard);
    const element = document.getElementById("createPost");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      id="global-create-post-btn"
      type="button"
      onClick={handleClick}
      className="fixed bottom-20 left-1/2 z-[9001] flex -translate-x-1/2 items-center justify-center lg:static lg:translate-x-0"
    >
      <LiquidGlass className="flex items-center gap-0 rounded-[22px] p-1 shadow-lg lg:rounded-full">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-[18px] text-white shadow-md lg:h-11 lg:w-11 lg:rounded-full ${
            discard
              ? "bg-[var(--pink)] shadow-[var(--shadow-pink)]"
              : "bg-[var(--text-black)]"
          }`}
        >
          {discard ? <FaPlus className="text-[1rem]" /> : <IoIosClose className="text-[1.5rem]" />}
        </span>
        <span className="hidden rounded-full bgGray px-3 py-2 text-[0.75rem] font-semibold text-[var(--text-black)] lg:block">
          {discard ? "Create Post" : "Close Composer"}
        </span>
      </LiquidGlass>
    </button>
  );
}

export default CreatePost;

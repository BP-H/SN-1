import { useEffect, useRef } from "react";
import LiquidGlass from "@/content/liquid glass/LiquidGlass";
import Profile from "@/content/profile/Profile";

export default function Settings({ errorMsg, setErrorMsg, setNotify, onClose }) {
  const settingsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        onClose?.();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={settingsRef}
      className="w-full max-w-[21.5rem]"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <LiquidGlass className="w-full rounded-[1.6rem] p-3">
        <div
          onClick={(event) => event.stopPropagation()}
          className="overflow-hidden"
        >
          <Profile errorMsg={errorMsg} setErrorMsg={setErrorMsg} setNotify={setNotify} />
        </div>
      </LiquidGlass>
    </div>
  );
}

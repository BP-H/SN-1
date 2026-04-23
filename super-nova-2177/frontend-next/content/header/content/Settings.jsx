import LiquidGlass from "@/content/liquid glass/LiquidGlass";
import { FaServer, FaUser } from "react-icons/fa";
import { FiSlack, FiLoader } from "react-icons/fi";
import content from "@/assets/content.json";
import SwitchBtn from "@/content/SwitchBtn";
import Profile from "@/content/profile/Profile";
import { useState, useRef, useEffect } from "react";

const iconsMap = {
  profile: <FaUser />,
  livebe: <FaServer />,
  aiassistant: <FiSlack />,
  agents: <FiLoader />,
};

function Settings({ errorMsg, setErrorMsg, activeBE, setActiveBE, setNotify, openProfile }) {
  const menusMap = {
    profile: (
      <Profile
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
        setNotify={setNotify}
      />
    ),
    livebe: <FaServer />,
    aiassistant: <FiSlack />,
    agents: <FiLoader />,
  };
  const settings = content.header?.settings || {};
  const [open, setOpen] = useState("");
  const [width, setWidth] = useState(false);
  
  const settingsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setOpen("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (openProfile) setOpen("profile");
  }, [openProfile]);

  return (
    <>
      <LiquidGlass className={`settings-right ${width ? "settings-right-tow" : ""} rounded-[30px] lg:absolute xl:top-24 p-3 flex items-center justify-center`} ref={settingsRef}>
        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="flex flex-col-reverse items-center justify-center gap-10 lg:flex-row xl:flex-col-reverse lg:gap-2"
        >
          {open && <div className="">{open && menusMap[open]}</div>}
          <div className="flex flex-col gap-2">
            {Object.entries(settings).map(([key, label]) => (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setWidth(true)
                  if(key === "profile") {
                    setOpen("profile");
                  } else {
                    setOpen(key);
                  }
                }}
                key={key}
                className={`cursor-pointer hover:scale-98 flex w-85 lg:w-88 pr-4  rounded-full shadow-md p-1 items-center gap-2 justify-between ${
                  key === open ? "bgPink text-white" : "bgGray"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center opacity-100 bg-white rounded-full h-13 w-13 text-[var(--transparent-black)] shadow-md">
                    {iconsMap[key]}
                  </div>
                  <p className="text-[0.7em]">{label}</p>
                </div>
                {key === "livebe" && (
                  <SwitchBtn activeBE={activeBE} setActiveBE={setActiveBE} />
                )}
              </div>
            ))}
          </div>
        </div>
      </LiquidGlass>
    </>
  );
}

export default Settings;

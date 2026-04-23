import { useEffect, useRef, useState } from "react";
import { FaServer, FaUser } from "react-icons/fa";
import LiquidGlass from "@/content/liquid glass/LiquidGlass";
import content from "@/assets/content.json";
import SwitchBtn from "@/content/SwitchBtn";
import Profile from "@/content/profile/Profile";

const iconsMap = {
  profile: <FaUser />,
  livebe: <FaServer />,
};

export default function Settings({
  errorMsg,
  setErrorMsg,
  activeBE,
  setActiveBE,
  setNotify,
  openProfile,
}) {
  const settings = content.header?.settings || {};
  const supportedEntries = Object.entries(settings).filter(([key]) =>
    ["profile", "livebe"].includes(key)
  );
  const [open, setOpen] = useState("profile");
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
    if (openProfile) {
      setOpen("profile");
    }
  }, [openProfile]);

  return (
    <div ref={settingsRef}>
      <LiquidGlass className="w-[min(92vw,40rem)] rounded-[30px] p-3">
        <div
          onClick={(event) => event.stopPropagation()}
          className="flex flex-col gap-3 lg:flex-row lg:items-start"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {supportedEntries.map(([key, label]) => (
              <div
                key={key}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(key);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpen(key);
                  }
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-full p-2 pr-4 text-left shadow-md hover:scale-[0.99] ${
                  key === open ? "bgPink text-white" : "bgGray text-[var(--text-black)]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--transparent-black)] shadow-sm">
                    {iconsMap[key]}
                  </span>
                  <span className="text-[0.78rem] font-semibold">{label}</span>
                </span>
                {key === "livebe" && (
                  <span className="shrink-0">
                    <SwitchBtn activeBE={activeBE} setActiveBE={setActiveBE} />
                  </span>
                )}
              </div>
            ))}
          </div>

          {open && (
            <div className="flex min-w-0 flex-[1.1] justify-center lg:justify-end">
              {open === "profile" ? (
                <Profile
                  errorMsg={errorMsg}
                  setErrorMsg={setErrorMsg}
                  setNotify={setNotify}
                />
              ) : (
                <div className="bgWhiteTrue flex min-h-[14rem] w-full max-w-[26rem] flex-col justify-between rounded-[24px] p-6 text-[0.92rem] text-[var(--text-black)] shadow-md">
                  <div>
                    <h2 className="mb-2 text-[1.1rem] font-bold">Backend mode</h2>
                    <p className="mb-4 opacity-75">
                      Switch between the live backend targets used by the app. Your choice
                      updates the feed, posting, voting, and comments together.
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-[18px] bg-[var(--gray)] px-4 py-3 shadow-sm">
                    <div>
                      <p className="text-[0.8rem] uppercase tracking-[0.12em] opacity-60">
                        Current target
                      </p>
                      <p className="text-[1rem] font-semibold">
                        {activeBE ? "Live backend" : "Local backend"}
                      </p>
                    </div>
                    <SwitchBtn activeBE={activeBE} setActiveBE={setActiveBE} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </LiquidGlass>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import content from "@/assets/content.json";
import LiquidGlass from "../liquid glass/LiquidGlass";
import Link from "next/link";
import { IoMenu } from "react-icons/io5";
import Settings from "./content/Settings";
import { IoIosClose } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { IoSearch } from "react-icons/io5";

import { useUser } from "../profile/UserContext";

import { useContext } from "react";
import { SearchInputContext } from "@/app/layout";

function HeaderMobile({
  activeBE,
  setActiveBE,
  errorMsg,
  setErrorMsg,
  setNotify,
  showSettings,
  setShowSettings,
  focusSearchInput,
}) {
  const [openProfile, setOpenProfile] = useState(false);
  const header = Object.values(content.header.mobiletitles);
  const [showHeader, setShowHeader] = useState(true);

  const { userData } = useUser();
  const { focusSearchInput: contextFocusSearchInput } = useContext(SearchInputContext);

  const iconsMap = {
    Proposals: [IoHome, ""],
    Profile: ["", ""],
    Search: [IoSearch, ""],
  };

  return (
    <div
      className={`z-9000 fixed bottom-2 left-1/2 transform -translate-x-1/2 lg:hidden transition-transform duration-300 ${
        showHeader ? "translate-y-0" : "-translate-y-[-100px]"
      }`}
    >
      <LiquidGlass className="flex items-center justify-center px-4 border-[1px] border-white py-3 rounded-[33px]">
        <ul className="flex items-center justify-center gap-5">
          <li
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(!showSettings);
              setOpenProfile(!openProfile);
            }}
          >
            {userData.avatar ? (
              <img className="rounded-full shadow-md min-w-13 w-13 h-13 min-h-13" src={userData.avatar} alt="user logo" />
            ) : userData.name ? (
              <button className="min-w-13 shadow-md w-13 h-13 min-h-13 rounded-full bg-[var(--gray)] flex items-center justify-center text-[0.8em] font-bold">
                {(() => {
                  if (!userData.name) return "";
                  const trimmed = userData.name.trim().replace(/\s+/g, " ");
                  const names = trimmed.split(" ");
                  if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                  return names[0][0].toUpperCase() + names[1][0].toUpperCase();
                })()}
              </button>
            ) : (
              <img className="min-w-13 w-13" src="./supernova.png" alt="logo" />
            )}
          </li>
          {header.map((item, index) => {
            const IconComponent = iconsMap[item]?.[0];
            const label = iconsMap[item]?.[1];

            return item === "Search" ? (
              <li
                className="cursor-pointer rounded-[20px] w-13 h-13 bgGray transform transition-transform duration-300 hover:scale-105 flex flex-col items-center justify-center"
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  (focusSearchInput || contextFocusSearchInput)();
                }}
              >
                {IconComponent && (
                  <IconComponent className="text-[var(--text-black)] text-2xl [filter:drop-shadow(0_0_3px_var(--blue))]" />
                )}
              </li>
            ) : (
              <li
                className={`cursor-pointer rounded-[20px] w-13 h-13 bgGray transform transition-transform duration-300 hover:scale-105 flex flex-col items-center justify-center`}
                key={index}
              >
                <Link
                  href={`/${item.toLowerCase()}`}
                  className="flex flex-col items-center justify-center font-semibold text-[0.6em] text-[var(--text-gray)]"
                >
                  {IconComponent && (
                    <IconComponent className="text-[var(--text-black)] text-2xl [filter:drop-shadow(0_0_3px_var(--blue))]" />
                  )}
                  {label && (
                    <span className="text-[var(--text-black)] text-[0.5em]">
                      {label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          <li
            className={`cursor-pointer hover:scale-105 rounded-[20px] w-13 h-13 flex items-center justify-center bgGray`}
          >
            {showSettings ? (
              <IoIosClose
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(false);
                }}
                className="text-[var(--pink)] text-5xl [filter:drop-shadow(0_0_7px_var(--pink))]"
              />
            ) : (
              <IoMenu
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(true);
                }}
                className="text-[var(--pink)] text-5xl [filter:drop-shadow(0_0_7px_var(--pink))]"
              />
            )}
          </li>
        </ul>
      </LiquidGlass>

      {showSettings && (
        <div className="absolute right-0 flex justify-center w-full mb-2 bottom-full z-120">
          <Settings
            setNotify={setNotify}
            errorMsg={errorMsg}
            setErrorMsg={setErrorMsg}
            setActiveBE={setActiveBE}
            activeBE={activeBE}
            openProfile={openProfile}
          />
        </div>
      )}
    </div>
  );
}

export default HeaderMobile;
